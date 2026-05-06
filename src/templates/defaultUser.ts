// Estructura del documento /users/{uid} en Firestore.
// Solo el bloque `profile` se llena en el onboarding inicial; el resto
// (plan_pro, fecha_expiracion, fecha_ultima_generacion) se gestionará desde
// Cloud Functions cuando integremos Stripe + Gemini en Fase 6 y 7.

export type Sexo = 'm' | 'f';

export type NivelActividad =
  | 'sedentario'
  | 'ligero'
  | 'moderado'
  | 'activo'
  | 'muy_activo';

export type Equipamiento = 'gimnasio' | 'casa' | 'sin_material';

export type Objetivo = 'volumen' | 'definicion' | 'recomposicion' | 'mantenimiento';

export type Restriccion =
  | 'vegano'
  | 'vegetariano'
  | 'sin_lactosa'
  | 'sin_gluten'
  | 'sin_frutos_secos';

// Modo de generación del plan: 'manual' (el usuario lo rellena) o 'ai'
// (Cloud Function + Gemini). Hoy solo manual está cableado; ai queda como
// flag preparado para Fase 6.
export type Modo = 'manual' | 'ai';

export interface UserProfile {
  // Datos personales
  nombre: string;
  edad: number | null;
  peso: number | null; // kg
  altura: number | null; // cm
  sexo: Sexo | null;

  // Estilo de vida
  actividad: NivelActividad | null;
  diasEntreno: number | null; // 0-7
  equipamiento: Equipamiento | null;

  // Objetivo
  objetivo: Objetivo | null;
  restricciones: Restriccion[];

  // Modo de generación
  modo: Modo;

  // Marca que indica si el onboarding terminó. La app comprueba este flag
  // tras login para decidir entre /onboarding y /app.
  completed: boolean;
}

export interface UserDocument {
  profile: UserProfile;

  // Monetización · gestionados desde Cloud Functions, no desde el cliente
  plan_pro: boolean;
  fecha_expiracion: number | null; // ms epoch
  fecha_ultima_generacion: number | null; // ms epoch

  // Metadata
  createdAt: number; // ms epoch — set en la primera escritura
  lastActive: number; // ms epoch — actualizado al entrar al dashboard
}

export function defaultProfile(): UserProfile {
  return {
    nombre: '',
    edad: null,
    peso: null,
    altura: null,
    sexo: null,
    actividad: null,
    diasEntreno: null,
    equipamiento: null,
    objetivo: null,
    restricciones: [],
    modo: 'manual',
    completed: false,
  };
}

export function defaultUserDocument(): UserDocument {
  const now = Date.now();
  return {
    profile: defaultProfile(),
    plan_pro: false,
    fecha_expiracion: null,
    fecha_ultima_generacion: null,
    createdAt: now,
    lastActive: now,
  };
}

// Etiquetas humanas para mostrar en UI · centralizadas para reutilizar entre
// onboarding, perfil y dashboard.
export const NIVELES_ACTIVIDAD: { value: NivelActividad; label: string; sub: string }[] = [
  { value: 'sedentario', label: 'Sedentario', sub: 'Poca o ninguna actividad física' },
  { value: 'ligero', label: 'Ligero', sub: '1-3 días/semana de ejercicio ligero' },
  { value: 'moderado', label: 'Moderado', sub: '3-5 días/semana de ejercicio moderado' },
  { value: 'activo', label: 'Activo', sub: '6-7 días/semana de ejercicio intenso' },
  { value: 'muy_activo', label: 'Muy activo', sub: 'Entreno dos veces al día' },
];

export const EQUIPAMIENTOS: { value: Equipamiento; label: string; sub: string }[] = [
  { value: 'gimnasio', label: 'Gimnasio', sub: 'Acceso a máquinas y peso libre' },
  { value: 'casa', label: 'En casa', sub: 'Mancuernas, gomas o similar' },
  { value: 'sin_material', label: 'Sin material', sub: 'Solo peso corporal' },
];

export const OBJETIVOS: { value: Objetivo; label: string; sub: string }[] = [
  { value: 'volumen', label: 'Volumen', sub: 'Ganar masa muscular' },
  { value: 'definicion', label: 'Definición', sub: 'Perder grasa, mantener músculo' },
  { value: 'recomposicion', label: 'Recomposición', sub: 'Ganar músculo y perder grasa' },
  { value: 'mantenimiento', label: 'Mantenimiento', sub: 'Conservar el peso y la forma actuales' },
];

export const RESTRICCIONES: { value: Restriccion; label: string }[] = [
  { value: 'vegano', label: 'Vegano' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'sin_lactosa', label: 'Sin lactosa' },
  { value: 'sin_gluten', label: 'Sin gluten' },
  { value: 'sin_frutos_secos', label: 'Sin frutos secos' },
];
