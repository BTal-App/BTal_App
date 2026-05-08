// Calcula la lista de items que la IA va a sobrescribir según el scope
// elegido. Lo usa el paso 2 del wizard de Generar IA para mostrar al
// usuario qué exactamente va a perder (con la opción de excluir items
// concretos) antes de confirmar la generación.
//
// La lista se agrupa por sección (Menú · Entreno · Compra) para que en
// la UI sea fácil de navegar visualmente. Cada item lleva su `source`
// para que la lógica de "no tocar lo del user" pueda colorearlos y
// auto-excluirlos.

import type {
  AiScopeChoice,
  CategoriaCompraKey,
  DayKey,
  MealKey,
  SourceTag,
  UserDocument,
} from '../templates/defaultUser';
import {
  CATEGORIAS_COMPRA,
  DAY_KEYS,
  MEAL_KEYS,
  formatAlimento,
} from '../templates/defaultUser';

// Identificador único y estable de un item dentro del documento del user.
// Forma: "section:path:partes". Ejemplos:
//   "menu:lun:desayuno"
//   "entrenos:4:0"          (plan 4, día 0 — el día entero como unidad)
//   "compra:proteinas:1"    (categoría proteínas, item índice 1)
export type ItemRefId = string;

export type AffectedSection = 'menu' | 'entrenos' | 'compra';

export interface AffectedItem {
  id: ItemRefId;
  section: AffectedSection;
  // Etiqueta principal · "Lunes · Desayuno" / "Día A · Empuje" / "Pechuga de pollo"
  label: string;
  // Sub-etiqueta opcional · "Avena 60g · Plátano · 4 claras" / "Pecho · Tríceps"
  // / "1 kg · 8.40 €"
  sublabel?: string;
  source: SourceTag;
}

const DAY_LABEL: Record<DayKey, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

// Acorta una lista de strings para usarla como sublabel · "a, b, c …"
function shortJoin(items: string[], max = 3): string {
  if (items.length === 0) return '';
  const first = items.slice(0, max).join(' · ');
  return items.length > max ? `${first} · …` : first;
}

// Items del menú · 28 (7 días × 4 comidas)
function menuItems(userDoc: UserDocument): AffectedItem[] {
  const out: AffectedItem[] = [];
  for (const day of DAY_KEYS) {
    for (const meal of MEAL_KEYS) {
      const c = userDoc.menu[day]?.[meal];
      if (!c) continue;
      out.push({
        id: `menu:${day}:${meal}`,
        section: 'menu',
        label: `${DAY_LABEL[day]} · ${MEAL_LABEL[meal]}`,
        sublabel:
          c.alimentos.length > 0
            ? shortJoin(c.alimentos.map(formatAlimento))
            : 'Vacío',
        source: c.source,
      });
    }
  }
  return out;
}

// Items de entreno · días del plan activo (o el sugerido por diasEntreno).
// Mostramos cada DÍA como un item (no cada ejercicio individual) para no
// agobiar la UI con 30+ filas. Si la IA decide regenerar el día, sustituye
// todos sus ejercicios; si el user excluye el día, queda intacto.
function entrenosItems(userDoc: UserDocument): AffectedItem[] {
  const planNum =
    userDoc.entrenos.planActivo
    ?? (userDoc.profile.diasEntreno && userDoc.profile.diasEntreno >= 1 && userDoc.profile.diasEntreno <= 7
      ? (userDoc.profile.diasEntreno as 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : null);
  if (planNum === null) return [];

  const plan = userDoc.entrenos.planes[planNum];
  if (!plan) return [];

  return plan.dias.map((d, idx) => ({
    id: `entrenos:${planNum}:${idx}`,
    section: 'entrenos' as const,
    label: `Día ${d.letra} · ${d.nombre}`,
    sublabel:
      d.tags.length > 0
        ? d.tags.join(' · ') + ` · ${d.ejercicios.length} ejercicios`
        : `${d.ejercicios.length} ejercicios`,
    source: d.source,
  }));
}

// Items de compra · todas las categorías, todos los productos.
function compraItems(userDoc: UserDocument): AffectedItem[] {
  const out: AffectedItem[] = [];
  for (const cat of CATEGORIAS_COMPRA) {
    const items = userDoc.compra[cat.key as CategoriaCompraKey] ?? [];
    items.forEach((it, idx) => {
      out.push({
        id: `compra:${cat.key}:${idx}`,
        section: 'compra',
        label: `${cat.emoji} ${it.nombre}`,
        sublabel:
          [it.cantidad, it.precio !== null ? `${it.precio.toFixed(2)} €` : null]
            .filter((v): v is string => Boolean(v))
            .join(' · ') || undefined,
        source: it.source,
      });
    });
  }
  return out;
}

// Devuelve la lista completa de items que la IA va a sobrescribir si se
// confirma la generación con el scope dado. Lista plana ordenada por
// sección — la UI puede agruparlos visualmente por `section`.
export function getAffectedItems(
  userDoc: UserDocument | null,
  scope: AiScopeChoice,
): AffectedItem[] {
  if (!userDoc) return [];
  switch (scope) {
    case 'all':
      return [...menuItems(userDoc), ...entrenosItems(userDoc), ...compraItems(userDoc)];
    case 'menu_compra':
      return [...menuItems(userDoc), ...compraItems(userDoc)];
    case 'menu_only':
      return menuItems(userDoc);
    case 'entrenos_only':
      return entrenosItems(userDoc);
  }
}

// Stats: cuántos items se sobrescribirán y cuántos se mantendrán dadas
// las exclusiones manuales y el flag allowUserItems.
//
// Reglas:
//   - source='user' + !allowUserItems → SIEMPRE excluido (auto-protegido)
//   - source='user' + allowUserItems  → puede sobrescribirse a menos que excludedIds lo proteja
//   - source='default'|'ai'           → se sobrescribe a menos que excludedIds lo proteja
export interface AffectedStats {
  total: number;
  willOverwrite: number;
  willKeep: number;
}

export function affectedStats(
  items: AffectedItem[],
  excludedIds: ReadonlySet<string>,
  allowUserItems: boolean,
): AffectedStats {
  let willKeep = 0;
  let willOverwrite = 0;
  for (const it of items) {
    if (isProtected(it, excludedIds, allowUserItems)) {
      willKeep += 1;
    } else {
      willOverwrite += 1;
    }
  }
  return { total: items.length, willOverwrite, willKeep };
}

// Predicado: ¿este item queda protegido (la IA NO lo toca)?
export function isProtected(
  item: AffectedItem,
  excludedIds: ReadonlySet<string>,
  allowUserItems: boolean,
): boolean {
  // Items del usuario auto-protegidos a menos que el toggle lo permita.
  if (item.source === 'user' && !allowUserItems) return true;
  // Exclusión manual del usuario en el wizard.
  return excludedIds.has(item.id);
}

// Construye el set inicial de IDs excluidos · auto-incluye los items
// con source='user' (para mostrarlos como "protegidos" en la UI).
// Cuando el toggle allowUserItems pasa a ON, este set se RESETEA a vacío
// (para que la lógica isProtected ya no los proteja por defecto y el
// user pueda elegir manualmente cuáles excluir).
export function initialExcludedIds(items: AffectedItem[]): Set<string> {
  return new Set(items.filter((it) => it.source === 'user').map((it) => it.id));
}
