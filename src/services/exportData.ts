import type { User } from 'firebase/auth';
import { getUserDocument, getAllRegistros } from './db';

// Export GDPR · entrega al usuario una copia completa de TODOS sus
// datos en formato JSON legible. Cumple el "derecho de portabilidad"
// del RGPD (art. 20) sin necesidad de tocar Cloud Functions · todo se
// arma cliente-side leyendo Firestore con las mismas rules de siempre.
//
// Qué incluye:
//   1. Metadatos del export (version, exportedAt, schema)
//   2. Datos de Auth (uid, email, displayName, providers, fechas) ·
//      lo que Firebase expone en el cliente, sin pedir token de admin.
//   3. Documento /users/{uid} completo (profile, menu, entrenos,
//      compra, suplementos, plan, preferences, registroStats, ...)
//   4. Subcolección /users/{uid}/registros/* (historial completo)
//   5. Snapshot relevante de localStorage del propio usuario
//
// Qué NO incluye:
//   - Datos de Firebase Auth privados (password hash, tokens,
//     fingerprints de dispositivo) · no son accesibles desde el cliente.
//   - Datos en backups internos de Firebase · si el user los quiere,
//     debe contactar soporte (cuando exista la dirección oficial).

export const EXPORT_SCHEMA_VERSION = 1;

const LOCALSTORAGE_PREFIX = 'btal_';

// Snapshot defensivo del Auth.User · evita serializar referencias
// internas (auth, stsTokenManager, etc.) que el SDK añade al objeto.
function pickAuthData(user: User) {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    photoURL: user.photoURL,
    phoneNumber: user.phoneNumber,
    isAnonymous: user.isAnonymous,
    providerData: user.providerData.map((p) => ({
      providerId: p.providerId,
      uid: p.uid,
      email: p.email,
      displayName: p.displayName,
      photoURL: p.photoURL,
      phoneNumber: p.phoneNumber,
    })),
    metadata: {
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
    },
  };
}

// Vuelca todas las entradas de localStorage que pertenecen a BTal
// (prefijo `btal_`). Cubre preferencias, dismissed banners, etc. Se
// hace en best-effort: si localStorage no está disponible (modo
// privado severo, SSR), devuelve un objeto vacío sin lanzar.
function readLocalStorageSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith(LOCALSTORAGE_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
  } catch {
    /* private mode · best effort */
  }
  return out;
}

export interface ExportPayload {
  meta: {
    schemaVersion: number;
    exportedAt: string; // ISO 8601
    appVersion: string;
    note: string;
  };
  auth: ReturnType<typeof pickAuthData>;
  firestore: {
    userDocument: unknown;
    registros: Record<string, unknown>;
  };
  localStorage: Record<string, string>;
}

// Construye el payload completo · lee Firestore y arma el objeto sin
// triggerar todavía la descarga (separado para poder testearlo o
// mostrarlo en pantalla en el futuro si hace falta).
export async function buildExportPayload(
  user: User,
  appVersion: string,
): Promise<ExportPayload> {
  // Las dos lecturas Firestore se pueden hacer en paralelo · no
  // dependen entre sí. Si una falla, propagamos · el caller maneja.
  const [userDoc, registros] = await Promise.all([
    getUserDocument(user.uid),
    getAllRegistros(user.uid),
  ]);

  return {
    meta: {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion,
      note:
        'Export completo de tu cuenta BTal. Incluye perfil, menús, entrenos, ' +
        'lista de la compra, suplementos, preferencias e historial de registros. ' +
        'Para más información sobre el RGPD: art. 20 (derecho de portabilidad).',
    },
    auth: pickAuthData(user),
    firestore: {
      userDocument: userDoc,
      registros,
    },
    localStorage: readLocalStorageSnapshot(),
  };
}

// Dispara la descarga del JSON · usa Blob + anchor sintético · funciona
// en cualquier navegador moderno. En Capacitor nativo (cuando lleguemos
// a Fase 9) este patrón puede no abrir un diálogo de guardar archivo;
// habrá que migrar a `@capacitor/filesystem` + share. Por ahora con
// PWA es suficiente.
function triggerJsonDownload(payload: ExportPayload, filename: string): void {
  // `pretty print` con indentación de 2 espacios · el archivo está
  // pensado para que el user lo pueda abrir y leer, no solo para que
  // otra herramienta lo procese.
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // No lo metemos en el DOM · `click()` programático funciona sin él
  // en todos los navegadores modernos. Liberamos el blob URL al
  // siguiente tick para no cortar la descarga en navegadores lentos.
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Helper · genera un nombre de archivo consistente con la fecha del
// export y un fragmento del uid para que el user pueda guardar varios
// exports sin sobrescribirse.
function buildFilename(uid: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const uidShort = uid.slice(0, 8);
  return `btal-export-${uidShort}-${date}.json`;
}

// Punto de entrada usado por Settings · construye el payload y dispara
// la descarga. Lanza si la lectura Firestore falla · el caller debe
// mostrar el error vía showError() y reset del loading state.
export async function downloadUserDataExport(
  user: User,
  appVersion: string,
): Promise<void> {
  const payload = await buildExportPayload(user, appVersion);
  triggerJsonDownload(payload, buildFilename(user.uid));
}
