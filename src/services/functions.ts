// Cliente de Cloud Functions (frontend).
//
// Las funciones viven en region europe-west1 (ver functions/src) · el
// getFunctions DEBE usar la misma región o el callable da 404/CORS.
//
// El SDK adjunta automáticamente el token de Auth + el token de App Check
// a cada llamada callable (App Check está inicializado en services/firebase
// y generatePlan tiene enforceAppCheck:true · sin token válido → 403).

import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { app, auth } from './firebase';

const REGION = 'europe-west1';

let functionsInstance: Functions | null = null;
function fns(): Functions {
  functionsInstance ??= getFunctions(app, REGION);
  return functionsInstance;
}

// Scope de generación · espejo de AiScopeChoice del schema.
export type GenerateScope = 'all' | 'menu_compra' | 'menu_only' | 'entrenos_only';

export interface GeneratePlanPayload {
  scope: GenerateScope;
  excludedIds?: string[];
  allowUserItems?: boolean;
}

export interface GeneratePlanResult {
  ok: boolean;
  scope: GenerateScope;
  generatedMenu: boolean;
  generatedEntreno: boolean;
}

// Error tipado que la UI puede mapear a un mensaje/acción concreta.
export type GenerateErrorKind =
  | 'limit_reached' // Free agotó la gen del ciclo (trae unlocksAt)
  | 'rate_limited' // demasiadas seguidas
  | 'capacity' // cap global diario o IA caída
  | 'needs_account' // invitado
  | 'needs_ai_mode' // modo manual
  | 'bad_profile' // perfil incompleto/fuera de rango
  | 'ai_error' // respuesta IA inválida
  | 'unknown';

export class GenerateError extends Error {
  kind: GenerateErrorKind;
  unlocksAt?: number;
  constructor(kind: GenerateErrorKind, message: string, unlocksAt?: number) {
    super(message);
    this.name = 'GenerateError';
    this.kind = kind;
    this.unlocksAt = unlocksAt;
  }
}

interface RawFnError {
  code?: string;
  message?: string;
  details?: { unlocksAt?: number } | undefined;
}

// Mapea el FunctionsError (code/message/details) a un GenerateError limpio.
function mapError(err: unknown): GenerateError {
  const e = err as RawFnError;
  const code = e.code ?? '';
  const msg = e.message ?? '';
  const unlocksAt = e.details?.unlocksAt;

  if (code === 'functions/resource-exhausted') {
    if (msg === 'limit_reached') {
      return new GenerateError('limit_reached', 'Has agotado tu generación de este ciclo.', unlocksAt);
    }
    return new GenerateError('rate_limited', 'Demasiadas generaciones seguidas. Espera un momento.');
  }
  if (code === 'functions/unavailable') {
    return new GenerateError('capacity', msg || 'La IA no está disponible ahora mismo. Inténtalo en unos minutos.');
  }
  if (code === 'functions/permission-denied') {
    return new GenerateError('needs_account', msg || 'Crea una cuenta para usar la IA.');
  }
  if (code === 'functions/failed-precondition') {
    // Distinguir modo manual vs perfil inválido por el contenido del mensaje.
    if (/modo ia/i.test(msg)) return new GenerateError('needs_ai_mode', msg);
    return new GenerateError('bad_profile', msg || 'Revisa tu perfil en Ajustes.');
  }
  if (code === 'functions/internal') {
    return new GenerateError('ai_error', msg || 'La IA devolvió una respuesta inesperada. Vuelve a intentarlo.');
  }
  if (code === 'functions/unauthenticated') {
    return new GenerateError('needs_account', 'Debes iniciar sesión.');
  }
  return new GenerateError('unknown', msg || 'Algo ha salido mal. Inténtalo de nuevo.');
}

// Llama a la Cloud Function generatePlan. Lanza GenerateError tipado en
// caso de fallo · el caller (AiGenerateModal) decide el mensaje/acción.
export async function generatePlan(
  payload: GeneratePlanPayload,
): Promise<GeneratePlanResult> {
  const callable = httpsCallable<GeneratePlanPayload, GeneratePlanResult>(
    fns(),
    'generatePlan',
  );
  try {
    const res = await callable(payload);
    return res.data;
  } catch (err) {
    throw mapError(err);
  }
}

// Borrado RGPD completo de la cuenta (doc + subcolecciones + Auth user) vía
// Cloud Function. Si la sesión no es reciente, la función responde
// 'requires-recent-login' (failed-precondition) · lo re-lanzamos con
// code 'auth/requires-recent-login' para que DeleteAccountModal dispare
// su flujo de reauth + reintento (mismo que ya tenía).
export async function deleteAccountFull(): Promise<void> {
  const callable = httpsCallable<Record<string, never>, { ok: boolean }>(
    fns(),
    'deleteAccount',
  );
  try {
    await callable({});
  } catch (err) {
    const e = err as RawFnError;
    if (e.code === 'functions/failed-precondition' && e.message === 'requires-recent-login') {
      const reauthErr = new Error('requires-recent-login') as Error & { code: string };
      reauthErr.code = 'auth/requires-recent-login';
      throw reauthErr;
    }
    throw err;
  }
}

// Cierra la sesión en TODOS los demás dispositivos manteniendo este. La
// Cloud Function revoca todos los refresh tokens y devuelve un custom token;
// re-iniciamos sesión con él para que ESTE dispositivo obtenga un refresh
// token nuevo (post-revocación) y no se cierre a sí mismo. Las demás sesiones
// quedan invalidadas y se cerrarán en su próximo refresh (~1h máx).
export async function revokeOtherSessions(): Promise<void> {
  const callable = httpsCallable<Record<string, never>, { token: string }>(
    fns(),
    'revokeOtherSessions',
  );
  const res = await callable({});
  await signInWithCustomToken(auth, res.data.token);
}
