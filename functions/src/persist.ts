// Mapeo de la respuesta validada de Gemini → shapes de Firestore,
// aplicando los CONTRATOS documentados (memorias + AiGenerateModal):
//
//   1. nombrePlato: cada Comida IA lo lleva (ya garantizado por el schema).
//   2. plan-activo: el plan de entreno generado se marca activo=true +
//      entrenos.activePlan = su id + se desmarca cualquier otro activo.
//   3. estructura/estructura2: campos ocultos pero preservados · se
//      rellenan con valor descriptivo (no se dejan undefined).
//   4. source: items IA = 'ai' (el SourceTag del frontend es
//      'default'|'ai'|'user'). El distintivo de macros estimadas vs
//      reales llegará en 6B (FatSecret) añadiendo 'ai-estimated'/'fatsecret'.
//   5. extras del menú: NO las toca la IA · se preservan las del user.

import type {
  Comida,
  ComidasDelDia,
  DayKey,
  DiaEntreno,
  EjercicioBadge,
  Entrenos,
  Menu,
  PlanEntreno,
} from './types.js';
import { DAY_KEYS, MEAL_DEFAULT_HORA, MEAL_KEYS } from './types.js';

// Badges válidos del schema de la app · cualquier badge que el LLM
// invente fuera de esta lista se descarta en mapTrainingDay.
const VALID_BADGES = new Set<EjercicioBadge>([
  'pecho', 'espalda', 'piernas', 'hombros', 'biceps', 'triceps',
  'core', 'fullbody', 'fuerza', 'hipertrofia', 'resistencia',
  'cardio', 'movilidad', 'empuje', 'tiron',
]);

// Normaliza el diaSemana que devuelve el LLM ("lunes", "Miércoles",
// "sábado"…) a una DayKey válida o null. Quita acentos + minúsculas +
// primeros 3 chars, y comprueba contra DAY_KEYS.
function normalizeDiaSemana(v: string | null): DayKey | null {
  if (!v) return null;
  const norm = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .slice(0, 3);
  return (DAY_KEYS as string[]).includes(norm) ? (norm as DayKey) : null;
}
import type {
  GeneratedEntrenos,
  GeneratedMeal,
  GeneratedMenu,
  GeneratedSuplementos,
  GeneratedTrainingDay,
} from './schemas.js';

// Source de los items generados por IA. Usamos 'ai' (no 'ai-estimated')
// porque el SourceTag del frontend es 'default'|'ai'|'user' · 'ai' es lo
// que dispara el badge "generado con IA" en las cards (MenuPage). El
// distintivo de "macros estimadas vs reales" llegará en 6B (FatSecret),
// momento en que se añadirá 'ai-estimated'/'fatsecret' al SourceTag del
// frontend con su manejo · hoy rompería la UI (source desconocido).
const AI_SOURCE = 'ai' as const;

function mapMeal(gen: GeneratedMeal, meal: keyof typeof MEAL_DEFAULT_HORA): Comida {
  return {
    alimentos: gen.alimentos.map((a) => ({ nombre: a.nombre, cantidad: a.cantidad })),
    hora: MEAL_DEFAULT_HORA[meal],
    kcal: Math.round(gen.kcal),
    prot: Math.round(gen.prot),
    carb: Math.round(gen.carb),
    fat: Math.round(gen.fat),
    source: AI_SOURCE,
    emoji: null,
    nombrePlato: gen.nombrePlato,
  };
}

// Construye el menú nuevo. Preserva SIEMPRE las extras de cada día (la IA
// no las genera). Si `preserveUser` (toggle "permitir tocar lo mío" en
// OFF), conserva también las comidas fijas con source='user' en vez de
// pisarlas con la generación IA · respeta el contrato de protección.
export function mapMenu(gen: GeneratedMenu, existing: Menu, preserveUser: boolean): Menu {
  const out = {} as Menu;
  for (const day of Object.keys(gen) as (keyof GeneratedMenu)[]) {
    const genDay = gen[day];
    const prevDay = existing[day];
    const pick = (meal: 'desayuno' | 'comida' | 'merienda' | 'cena'): Comida => {
      const prev = prevDay?.[meal];
      if (preserveUser && prev && prev.source === 'user') return prev;
      return mapMeal(genDay[meal], meal);
    };
    const comidas: ComidasDelDia = {
      desayuno: pick('desayuno'),
      comida: pick('comida'),
      merienda: pick('merienda'),
      cena: pick('cena'),
      // Preservar extras del user (la IA no las genera).
      extras: prevDay?.extras ?? [],
    };
    out[day] = comidas;
  }
  return out;
}

function mapTrainingDay(gen: GeneratedTrainingDay): DiaEntreno {
  // Filtra a badges válidos del schema (descarta inventados) + máx 3.
  const badges = gen.badges
    .map((b) => b.toLowerCase().trim())
    .filter((b): b is EjercicioBadge => VALID_BADGES.has(b as EjercicioBadge))
    .slice(0, 3);
  return {
    titulo: gen.titulo,
    descripcion: gen.descripcion,
    tiempoEstimadoMin:
      gen.tiempoEstimadoMin === null ? null : Math.round(gen.tiempoEstimadoMin),
    diaSemana: normalizeDiaSemana(gen.diaSemana),
    badge: badges[0] ?? '',
    badgeCustom: '',
    badge2: badges[1] ?? '',
    badgeCustom2: '',
    badge3: badges[2] ?? '',
    badgeCustom3: '',
    ejercicios: gen.ejercicios.map((e) => ({
      nombre: e.nombre,
      desc: e.desc,
      series: e.series,
      source: 'ai' as const,
    })),
    comentario: gen.comentario,
    source: 'ai',
  };
}

// Rellena los 7 planes builtin (1dias..7dias) con los días generados por
// la IA (decisión 29-may: NO crear plan nuevo suelto · rellenar los
// builtin). Cada builtin conserva su id/nombre/estructura/builtIn=true y
// solo se le reemplazan los `dias` con los ejercicios generados para ese
// número de días. El plan activo pasa a ser el que coincide con
// diasEntreno (clamp 1-7; 0/null → 4dias por defecto, como la app). Los
// planes custom del user se conservan (desmarcados como activo).
export function mapAllBuiltInPlans(
  existing: Entrenos,
  gen: GeneratedEntrenos,
  diasEntreno: number,
): Entrenos {
  const planes: Record<string, PlanEntreno> = {};
  // Copia todo lo existente desmarcando activo (custom incluidos).
  for (const [id, p] of Object.entries(existing.planes)) {
    planes[id] = { ...p, activo: false };
  }
  // Rellena cada builtin Ndias con los días generados de la clave "N".
  for (let n = 1; n <= 7; n++) {
    const id = `${n}dias`;
    const genDays = gen[String(n) as keyof GeneratedEntrenos] ?? [];
    const prev = planes[id];
    planes[id] = {
      id,
      nombre: prev?.nombre ?? `Plan ${n} Día${n === 1 ? '' : 's'}`,
      estructura: prev?.estructura ?? `${n} día${n === 1 ? '' : 's'}/semana`,
      estructura2: prev?.estructura2 ?? '',
      // Ajusta al número exacto de días del builtin · trunca si la IA dio
      // de más; si dio de menos, deja lo que haya (el prompt pide N exactos).
      dias: genDays.slice(0, n).map(mapTrainingDay),
      builtIn: true,
      activo: false,
    };
  }
  // Activo = builtin que coincide con diasEntreno (0/null → 4dias default).
  const clampedN = Math.min(7, Math.max(1, diasEntreno || 4));
  const activeId = `${clampedN}dias`;
  if (planes[activeId]) {
    planes[activeId] = { ...planes[activeId], activo: true };
  }
  return { activePlan: activeId, planes };
}

// Normaliza la recomendación de suplementos de la IA a DayKeys válidas y
// únicas (la IA puede escribir "lunes"/"Lun"/"lun" o inventar días). Se
// aplica a suplementos.daysWithBatido / daysWithCreatina vía dot-path en
// generatePlan, preservando config/stock/contadores del user.
export function mapSuplementosDias(gen: GeneratedSuplementos): {
  daysWithBatido: DayKey[];
  daysWithCreatina: DayKey[];
} {
  const norm = (arr: string[]): DayKey[] => {
    const seen = new Set<DayKey>();
    for (const d of arr) {
      const k = normalizeDiaSemana(d);
      if (k) seen.add(k);
    }
    // Orden lun..dom estable (orden de DAY_KEYS).
    return DAY_KEYS.filter((d) => seen.has(d));
  };
  return {
    daysWithBatido: norm(gen.batidoDias),
    daysWithCreatina: norm(gen.creatinaDias),
  };
}

// Validación post-Zod adicional: coherencia de macros. Si las kcal de una
// comida se desvían >40% de la suma de macros (prot×4+carb×4+fat×9), las
// recalculamos desde los macros (más fiables que el número suelto de la IA).
export function reconcileMealMacros(menu: Menu): Menu {
  for (const day of Object.keys(menu) as (keyof Menu)[]) {
    for (const meal of MEAL_KEYS) {
      const c = menu[day][meal];
      const fromMacros = c.prot * 4 + c.carb * 4 + c.fat * 9;
      if (fromMacros > 0 && Math.abs(c.kcal - fromMacros) / fromMacros > 0.4) {
        c.kcal = Math.round(fromMacros);
      }
    }
  }
  return menu;
}
