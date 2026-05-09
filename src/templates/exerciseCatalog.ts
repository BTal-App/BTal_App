// ────────────────────────────────────────────────────────────────────────────
// exerciseCatalog · Sub-fase 2D
//
// Catálogo de ejercicios predefinidos por badge (grupo muscular / tipo
// de ejercicio / tipo de movimiento). Réplica del v1 EXERCISES_BY_TYPE
// + BADGE_TYPES + BADGE_GROUPS. Lo separamos de defaultUser.ts para
// mantenerlo limpio · este archivo es solo lookup tables.

import type { EjercicioBadge } from './defaultUser';

// Metadata de un badge · valor (clave en el doc), label visible y la
// clase CSS que se aplica al chip. La clase usa convención `b-{val}`
// y se mapea a colores en EntrenoPage.css.
export interface BadgeMeta {
  val: EjercicioBadge;
  label: string;
  cls: string;
}

export const BADGE_TYPES: BadgeMeta[] = [
  // Grupo muscular
  { val: 'pecho', label: 'PECHO', cls: 'b-pecho' },
  { val: 'espalda', label: 'ESPALDA', cls: 'b-espalda' },
  { val: 'piernas', label: 'PIERNAS', cls: 'b-piernas' },
  { val: 'hombros', label: 'HOMBROS', cls: 'b-hombros' },
  { val: 'biceps', label: 'BÍCEPS', cls: 'b-biceps' },
  { val: 'triceps', label: 'TRÍCEPS', cls: 'b-triceps' },
  { val: 'core', label: 'CORE', cls: 'b-core' },
  { val: 'fullbody', label: 'FULL BODY', cls: 'b-fullbody' },
  // Tipo de ejercicio
  { val: 'fuerza', label: 'FUERZA', cls: 'b-fuerza' },
  { val: 'hipertrofia', label: 'HIPERTROFIA', cls: 'b-hipertrofia' },
  { val: 'resistencia', label: 'RESISTENCIA', cls: 'b-resistencia' },
  { val: 'cardio', label: 'CARDIO', cls: 'b-cardio' },
  { val: 'movilidad', label: 'MOVILIDAD', cls: 'b-movilidad' },
  // Tipo de movimiento
  { val: 'empuje', label: 'EMPUJE', cls: 'b-empuje' },
  { val: 'tiron', label: 'TIRÓN', cls: 'b-tiron' },
  // Custom · usa el campo `badgeCustom*` para nombre libre
  { val: 'custom', label: 'PERSONALIZADO', cls: 'b-custom' },
];

// Mapa rápido val → meta · evita iterar el array en cada render.
export const BADGE_BY_VAL: Record<EjercicioBadge, BadgeMeta> = BADGE_TYPES.reduce(
  (acc, b) => {
    acc[b.val] = b;
    return acc;
  },
  {} as Record<EjercicioBadge, BadgeMeta>,
);

// Grupos de badges para el dropdown del editor · separa muscle / tipo /
// movimiento para que el user encuentre fácil. Réplica de v1 BADGE_GROUPS.
export const BADGE_GROUPS: { label: string; options: EjercicioBadge[] }[] = [
  {
    label: 'Grupo muscular',
    options: ['pecho', 'espalda', 'piernas', 'hombros', 'biceps', 'triceps', 'core', 'fullbody'],
  },
  {
    label: 'Tipo de ejercicio',
    options: ['fuerza', 'hipertrofia', 'resistencia', 'cardio', 'movilidad'],
  },
  {
    label: 'Tipo de movimiento',
    options: ['empuje', 'tiron'],
  },
  {
    label: 'Otro',
    options: ['custom'],
  },
];

// Catálogo de ejercicios predefinidos · réplica del v1. El editor
// muestra un dropdown filtrado por los badges del día (1-3 slots) +
// "Personalizado" al final para escribir texto libre.
//
// Si más adelante queremos curar/extender la lista, aquí se hace.
// 'custom' NO tiene catálogo (es el caso libre).
export const EXERCISES_BY_TYPE: Record<Exclude<EjercicioBadge, 'custom'>, string[]> = {
  pecho: [
    'Press banca',
    'Press banca inclinado',
    'Press banca declinado',
    'Press inclinado con mancuernas',
    'Aperturas con mancuernas',
    'Aperturas en polea',
    'Cruces en polea alta',
    'Fondos en paralelas',
    'Flexiones',
    'Press en máquina',
  ],
  espalda: [
    'Dominadas',
    'Dominadas agarre supino',
    'Remo con barra',
    'Remo con mancuerna',
    'Remo Pendlay',
    'Remo en polea baja',
    'Jalón al pecho',
    'Jalón agarre neutro',
    'Peso muerto',
    'Pull-over en polea',
  ],
  piernas: [
    'Sentadilla libre',
    'Sentadilla frontal',
    'Sentadilla búlgara',
    'Prensa de piernas',
    'Hip thrust',
    'Peso muerto rumano',
    'Zancadas',
    'Curl femoral tumbado',
    'Extensión de cuádriceps',
    'Elevación de talones',
  ],
  hombros: [
    'Press militar con barra',
    'Press militar con mancuernas',
    'Press Arnold',
    'Elevaciones laterales',
    'Elevaciones frontales',
    'Pájaros (posterior)',
    'Face pull',
    'Remo al mentón',
    'Encogimientos',
    'Press landmine',
  ],
  biceps: [
    'Curl con barra',
    'Curl con mancuernas',
    'Curl martillo',
    'Curl inclinado con mancuernas',
    'Curl predicador',
    'Curl en polea',
    'Curl concentrado',
    'Curl 21s',
    'Curl araña',
    'Dominadas supinas',
  ],
  triceps: [
    'Press francés',
    'Extensión en polea',
    'Fondos en banco',
    'Fondos en paralelas',
    'Extensión sobre la cabeza',
    'Patadas de tríceps',
    'Press cerrado',
    'Copa con mancuerna',
    'Extensión en polea agarre inverso',
    'Flexiones diamante',
  ],
  core: [
    'Plancha frontal',
    'Plancha lateral',
    'Crunch abdominal',
    'Elevación de piernas',
    'Rueda abdominal',
    'Russian twist',
    'Toe touches',
    'Bicicleta abdominal',
    'Hollow hold',
    'Dead bug',
  ],
  fullbody: [
    'Burpees',
    'Clean and press',
    'Snatch',
    'Thrusters',
    'Turkish get-up',
    'Kettlebell swing',
    'Man maker',
    'Peso muerto con press',
    'Sentadilla con press',
    'Mountain climbers',
  ],
  fuerza: [
    'Sentadilla trasera',
    'Peso muerto convencional',
    'Peso muerto sumo',
    'Press banca',
    'Press militar',
    'Remo Pendlay',
    'Cargada de potencia',
    'Arrancada',
    'Zancada trasera',
    'Press cerrado',
  ],
  hipertrofia: [
    'Press banca inclinado',
    'Remo con mancuerna',
    'Sentadilla hack',
    'Curl femoral',
    'Elevaciones laterales',
    'Curl con mancuernas',
    'Extensión en polea',
    'Press en máquina',
    'Jalón al pecho',
    'Aperturas en máquina',
  ],
  resistencia: [
    'Circuito kettlebell',
    'Burpees',
    'Saltos al cajón',
    'Flexiones',
    'Sentadilla al aire',
    'Remo con banda',
    'Planchas dinámicas',
    'Saltos de tijera',
    'Mountain climbers',
    'Thrusters con mancuerna',
  ],
  cardio: [
    'Correr en cinta',
    'Bicicleta estática',
    'Elíptica',
    'Remo en máquina',
    'Saltar a la comba',
    'Escaladora',
    'Sprints',
    'HIIT en bici',
    'Caminata inclinada',
    'Natación',
  ],
  movilidad: [
    'Movilidad de cadera',
    'Movilidad de hombro',
    'Movilidad torácica',
    'Estiramiento de isquios',
    'Estiramiento de flexores de cadera',
    'World’s greatest stretch',
    'Deep squat hold',
    'Cat-cow',
    'Thread the needle',
    '90/90 de cadera',
  ],
  empuje: [
    'Press banca',
    'Press militar',
    'Press inclinado con mancuernas',
    'Press francés',
    'Fondos en paralelas',
    'Aperturas en polea',
    'Elevaciones laterales',
    'Flexiones',
    'Extensión en polea',
    'Press Arnold',
  ],
  tiron: [
    'Dominadas',
    'Remo con barra',
    'Remo con mancuerna',
    'Jalón al pecho',
    'Face pull',
    'Curl con barra',
    'Curl con mancuernas',
    'Pull-over',
    'Remo en polea baja',
    'Peso muerto rumano',
  ],
};

// Devuelve la lista de ejercicios sugeridos para un día según sus
// badges (1-3). Concatena sin duplicar y omite 'custom'.
export function getSuggestedExercises(
  badges: ReadonlyArray<EjercicioBadge | ''>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of badges) {
    if (!b || b === 'custom') continue;
    const list = EXERCISES_BY_TYPE[b as Exclude<EjercicioBadge, 'custom'>];
    if (!list) continue;
    for (const ex of list) {
      if (seen.has(ex)) continue;
      seen.add(ex);
      out.push(ex);
    }
  }
  return out;
}

// Versión agrupada · réplica del v1 `peExerciseSelectHTML` · devuelve
// los ejercicios agrupados por badge para usar en `<optgroup>`. Si no
// hay badges válidos (todos 'custom' o vacíos), devuelve TODAS las
// categorías para que el user pueda elegir cualquier ejercicio.
export function getGroupedSuggestedExercises(
  badges: ReadonlyArray<EjercicioBadge | ''>,
): { label: string; exercises: string[] }[] {
  const validBadges: EjercicioBadge[] = [];
  const seen = new Set<EjercicioBadge>();
  for (const b of badges) {
    if (!b || b === 'custom') continue;
    if (!EXERCISES_BY_TYPE[b as Exclude<EjercicioBadge, 'custom'>]) continue;
    if (seen.has(b)) continue;
    seen.add(b);
    validBadges.push(b);
  }
  const usedBadges =
    validBadges.length > 0
      ? validBadges
      : (Object.keys(EXERCISES_BY_TYPE) as Exclude<EjercicioBadge, 'custom'>[]);
  return usedBadges.map((b) => ({
    label: BADGE_BY_VAL[b]?.label ?? b.toUpperCase(),
    exercises:
      EXERCISES_BY_TYPE[b as Exclude<EjercicioBadge, 'custom'>] ?? [],
  }));
}

// Sentinel value para el option "✏ Personalizado…" del select de
// ejercicios · réplica del v1 (`__custom__`).
export const CUSTOM_EXERCISE_SENTINEL = '__custom__';

// Helper · devuelve el label visible de un día con badges. Maneja el
// caso 'custom' (usa el badgeCustom asociado) y concatena los slots
// activos con · de separación.
export function badgeLabel(
  badge: EjercicioBadge | '',
  badgeCustom: string,
): string | null {
  if (!badge) return null;
  if (badge === 'custom') return badgeCustom.trim() || 'Personalizado';
  return BADGE_BY_VAL[badge]?.label ?? null;
}
