// Mapeo de la respuesta validada de Gemini → shapes de Firestore,
// aplicando los CONTRATOS documentados (memorias + AiGenerateModal):
//
//   1. nombrePlato: cada Comida IA lo lleva (ya garantizado por el schema).
//   2. plan-activo: el plan de entreno generado se marca activo=true +
//      entrenos.activePlan = su id + se desmarca cualquier otro activo.
//   3. estructura/estructura2: campos ocultos pero preservados · se
//      rellenan con valor descriptivo (no se dejan undefined).
//   4. source: items IA = 'ai-estimated' en 6A (macros estimadas por IA ·
//      6B las hará reales con FatSecret/OFF y pasará a 'ai'/'fatsecret').
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
  GeneratedMeal,
  GeneratedMenu,
  GeneratedTrainingDay,
  GeneratedTrainingPlan,
} from './schemas.js';

// En 6A las macros las estima la IA · 6B las hará reales (FatSecret/OFF).
const AI_SOURCE = 'ai-estimated' as const;

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

export function newAiPlanId(): string {
  return `plan_ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Mapea el plan generado a PlanEntreno custom · activo=true, builtIn=false.
export function mapTrainingPlan(gen: GeneratedTrainingPlan): PlanEntreno {
  const dias = gen.dias.length;
  return {
    id: newAiPlanId(),
    nombre: gen.nombre || `Plan IA · ${dias} días`,
    // estructura/estructura2 ocultos en UI pero preservados · valor sensato.
    estructura: `${dias} día${dias === 1 ? '' : 's'}/semana`,
    estructura2: '',
    dias: gen.dias.map(mapTrainingDay),
    builtIn: false,
    activo: true,
  };
}

// Inserta el plan nuevo en entrenos respetando la invariante "solo un
// plan activo": desmarca activo en todos los demás + apunta activePlan.
export function applyTrainingPlan(existing: Entrenos, plan: PlanEntreno): Entrenos {
  const planes: Record<string, PlanEntreno> = {};
  for (const [id, p] of Object.entries(existing.planes)) {
    planes[id] = { ...p, activo: false };
  }
  planes[plan.id] = plan;
  return { activePlan: plan.id, planes };
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
