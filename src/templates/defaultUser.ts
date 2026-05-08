// Estructura del documento /users/{uid} en Firestore.
// Solo el bloque `profile` se llena en el onboarding inicial; el resto
// (plan_pro, fecha_expiracion, fecha_ultima_generacion) se gestionará desde
// Cloud Functions cuando integremos Stripe + Gemini en Fase 6 y 7.

import type { Preferences } from '../utils/units';

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

// Cuando el usuario elige 'ai' debe decidir QUÉ secciones quiere que la
// IA genere. Esta es la "preferencia por defecto" — la primera generación
// post-onboarding usa esta elección. Después, cada botón "Regenerar con
// IA" de cada tab tiene su propia mini-elección que NO modifica este
// campo (ej. el user pidió 'all' al registrarse y luego solo regenera
// entrenos puntualmente desde la tab Entreno).
//
// - 'all'           · menú semanal + lista de la compra + plan de entreno
// - 'menu_compra'   · menú + compra (sin entrenos · los rellena el user)
// - 'menu_only'     · solo menú (sin compra ni entrenos)
// - 'entrenos_only' · solo entrenos (nutrición la rellena el user)
//
// Si modo === 'manual' este campo es null (no aplica).
export type AiScopeChoice = 'all' | 'menu_compra' | 'menu_only' | 'entrenos_only';

// Origen de un item dentro de menu/entrenos/compra. Usado por la lógica de
// "la IA no toca lo del usuario":
//   - 'default' → item de plantilla vacía (defaultUser) o sembrado por demoUser.
//                 La IA puede sobrescribirlo libremente.
//   - 'ai'      → item creado por la última generación de Gemini.
//                 La IA puede sobrescribirlo (es lo que generó la vez anterior).
//   - 'user'    → item creado o editado por el usuario en la app (Fase 2B+).
//                 La IA NO lo toca a menos que el user active el toggle
//                 "permitir tocar lo mío" en el AiGenerateModal.
export type SourceTag = 'default' | 'ai' | 'user';

// Valor que emite el componente <StepMode> · vive aquí (junto al resto
// de tipos de dominio) para evitar que el modal de cambio en Settings
// y el onboarding tengan que importar de un archivo de UI.
export interface StepModeValue {
  modo: Modo | null;
  aiScope: AiScopeChoice | null;
}

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

  // ── Personalización para la IA (paso 4 del onboarding) ──
  // Todos los campos son opcionales. Si el user no los rellena, la IA
  // genera con las restricciones genéricas (vegano, sin gluten, etc.).
  // Cuando estén poblados, el prompt los inyecta como reglas obligatorias
  // al generar tanto menú como plan de entreno.

  // Texto libre · "Cuéntanos cualquier otro detalle (objetivos, lesiones,
  // preferencias…)". Se inyecta tal cual en el prompt — el sanitizado de
  // Cloud Function escapa caracteres peligrosos antes de pasarlo a Gemini.
  notas: string;

  // Intolerancias específicas. Strings — los predefinidos vienen de
  // INTOLERANCIAS_COMUNES (lactosa, fructosa, etc.). Items con texto libre
  // se almacenan tal cual ("histamina", "salicilatos", lo que sea).
  intolerancias: string[];

  // Alergias específicas. Strings — los predefinidos vienen de
  // ALERGIAS_COMUNES (los 14 alérgenos del Reglamento UE 1169/2011).
  // Texto libre permitido para alergias menos comunes.
  alergias: string[];

  // Alimentos / platos que el user NO quiere ver en sus comidas.
  // Texto libre con chips (ej. "atún", "hígado", "coliflor").
  alimentosProhibidos: string[];

  // Alimentos / platos que el user QUIERE que aparezcan obligatoriamente.
  // Texto libre con chips (ej. "salmón al menos 2 veces a la semana").
  alimentosObligatorios: string[];

  // Ingredientes favoritos del user. La IA los priorizará en el plan.
  // Texto libre con chips (ej. "aguacate", "huevos", "espinacas").
  ingredientesFavoritos: string[];

  // Objetivo calórico diario en kcal. Comportamiento:
  //   null → la app calcula automáticamente con Mifflin-St Jeor +
  //          factor de actividad + ajuste por objetivo (ver utils/calorias.ts).
  //          La UI muestra el valor calculado pero también un botón
  //          "Ajustar manualmente" para sobrescribirlo.
  //   number → el user lo ha fijado a mano. La app respeta su valor.
  // Se almacena en Firestore para que persista cross-device y para que la
  // IA lo use como referencia al generar el menú.
  objetivoKcal: number | null;

  // Modo de generación
  modo: Modo;
  // Subdivisión de modo='ai' · qué secciones genera la IA. Null si manual.
  // La elección se hace en el paso 4 del onboarding (junto a la elección
  // de modo) y se puede cambiar luego desde Settings → Modo de generación.
  aiScope: AiScopeChoice | null;

  // Marca que indica si el onboarding terminó. La app comprueba este flag
  // tras login para decidir entre /onboarding y /app.
  completed: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// MENÚ NUTRICIONAL
//
// 7 días × 4 comidas. Mismo schema en modo IA (Gemini lo rellena) y manual
// (el user lo edita comida a comida). Macros se almacenan numéricos para
// poder sumar el total del día sin parseos. Una comida sin alimentos se
// considera "vacía" — los empty states de la UI miran `alimentos.length`.

export type DayKey = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type MealKey = 'desayuno' | 'comida' | 'merienda' | 'cena';

// Cada elemento de la lista de alimentos de una comida lleva nombre y
// cantidad por separado (Sub-fase 2B.4). El nombre es obligatorio (string
// no vacío); la cantidad es opcional — un alimento puede listarse sin
// cantidad concreta (ej. "Ensalada mixta", "Verduras al horno").
export interface Alimento {
  nombre: string;
  cantidad: string; // ej "60 g", "250 ml", "1", "1 cdta", "" (sin cantidad)
}

export interface Comida {
  // Lista de alimentos con nombre y cantidad separados.
  alimentos: Alimento[];
  // Hora HH:mm en 24h, opcional — si no se pone la app usa la hora por
  // defecto del MealKey (08:00, 14:00, 17:30, 21:00).
  hora: string | null;
  kcal: number;
  prot: number; // g
  carb: number; // g
  fat: number; // g
  // Origen del item — la IA respeta items con source='user' a menos que
  // el user active "permitir tocar lo mío" en el AiGenerateModal.
  source: SourceTag;
  // Emoji custom opcional · si está null/undefined, la UI usa el default
  // por meal-key (MEAL_EMOJI). Para extras, el default es 🍽. Editable
  // desde el modal de edición vía EmojiPicker.
  emoji?: string | null;
  // Nombre del plato · texto libre que describe el contenido (ej. "Bowl
  // de avena con frutos rojos"). En la card del menú es lo único que se
  // muestra como descripción; al abrir el sheet aparece prominente justo
  // antes de la lista de ingredientes.
  //
  // ⚠ CONTRATO DE LA IA (Fase 6) · `generatePlan` Cloud Function:
  //   - La IA DEBE rellenar `nombrePlato` para cada `Comida` que genere
  //     (4 fijas + cualquier extra). No es opcional para items con
  //     source='ai'. Razón: el menú es una vista resumen y vacíos
  //     desincronizan visualmente las cards.
  //   - Estilo recomendado: 3-7 palabras, primera mayúscula, sin punto
  //     final. Ej: "Pollo con arroz y brócoli", "Bowl de avena tropical".
  //   - Si la IA tiene dudas, mejor un nombre genérico ("Comida proteica")
  //     que dejarlo en null.
  //
  // null/undefined solo en items con source='default' o source='user'
  // antes de que el user lo edite · la UI muestra placeholder en ese caso.
  nombrePlato?: string | null;
}

// Comida extra · un slot custom que el user añade además de las 4 fijas.
// Diferencia con Comida normal:
//   - id: identificador estable para edits/removes (timestamp en base 36).
//   - nombre: título libre ("Pre-entreno", "Cena 2", "Snack tarde").
// El resto de campos es idéntico a Comida · se ordena por hora junto al
// resto en MenuPage. Límite blando de 8 extras por día (el provider lo
// valida) para evitar docs Firestore obesos.
export interface ComidaExtra extends Comida {
  id: string;
  nombre: string;
}

// Genera un id único para una ComidaExtra. Usamos base36 del timestamp +
// 4 chars random · suficiente para evitar colisiones aunque el user cree
// dos extras en el mismo ms (raro pero posible si pulsa rápido).
export function newExtraId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${t}${r}`;
}

// Subdocumento del menú · 4 comidas fijas + N extras del día.
// Mantenemos las 4 keys literales (desayuno/comida/merienda/cena) en lugar
// de un array para que el código que ya usa `menu[day][meal]` con MealKey
// siga funcionando · TS lo tipa correctamente y no rompe nada existente.
export interface ComidasDelDia {
  desayuno: Comida;
  comida: Comida;
  merienda: Comida;
  cena: Comida;
  extras: ComidaExtra[];
}

// Límite blando de extras por día · validado en el provider antes de
// añadir. Si ya hay 8 lanzamos error y el caller (MenuPage) muestra toast.
export const MAX_EXTRAS_POR_DIA = 8;

// Formatea un Alimento para mostrar en una sola línea de texto.
// "Nombre · Cantidad" si tiene cantidad, solo "Nombre" si no.
// Centralizado aquí para que MealCard, MealSheet, AiPromptSummary y
// AiAffectedItems lo usen igual y sean consistentes.
export function formatAlimento(a: Alimento): string {
  if (!a.cantidad) return a.nombre;
  return `${a.nombre} · ${a.cantidad}`;
}

// Parsea un string suelto como "Avena 60 g" en { nombre, cantidad }.
// Heurística: captura del final "número (decimal opcional) + unidad de
// letras opcional". Si no encaja, todo va a nombre y cantidad queda
// vacía. Usado por la migración de docs viejos que tenían alimentos
// como string[] (Sub-fases 2B.0-2B.3) al nuevo schema Alimento[].
export function parseAlimentoString(raw: string): Alimento {
  const trimmed = raw.trim();
  if (!trimmed) return { nombre: '', cantidad: '' };
  // Patrón: ".+ {espacio} {número con opcional .,} {opcional unidad}"
  // Ej: "Avena 60 g" → "Avena" + "60 g"
  //     "Yogur griego 200g" → "Yogur griego" + "200g"
  //     "Miel 1 cdta" → "Miel" + "1 cdta"
  //     "Brócoli al vapor" → "Brócoli al vapor" + ""
  //     "1 plátano mediano" → "1 plátano mediano" + "" (cantidad al inicio
  //          no se extrae · es difícil decidir cuánto del resto es nombre)
  const m = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d+)?(?:\s*[a-zA-Zñü.]+)?)$/);
  if (m) {
    return { nombre: m[1].trim(), cantidad: m[2].trim() };
  }
  return { nombre: trimmed, cantidad: '' };
}

export type Menu = Record<DayKey, ComidasDelDia>;

// ────────────────────────────────────────────────────────────────────────────
// ENTRENOS
//
// 7 planes preestablecidos (de 1 a 7 días). El user elige cuál es su plan
// activo en `planActivo`. Cada plan tiene N días con sus ejercicios. En
// modo manual los ejercicios empiezan vacíos; en modo IA los rellena
// Gemini con peso+series+reps según el perfil.

export type TipoEjercicio = 'fuerza' | 'hipertrofia' | 'cardio' | 'movilidad';

export interface Ejercicio {
  nombre: string;
  // Series y rango de reps · ej: "4×6-8", "3×12", "30 min".
  setsReps: string;
  // Notas técnicas opcionales · ej: "calentamiento progresivo".
  nota?: string;
  // Peso de referencia para el plan (kg). El registro real va en otra
  // colección (registros/{fecha}) — esto es solo el "peso objetivo".
  pesoKg: number | null;
  tipo: TipoEjercicio;
  source: SourceTag;
}

export interface DiaEntreno {
  // Letra (A/B/C/...) y nombre tipo "Empuje", "Tirón", "Pierna", "Descanso".
  letra: string;
  nombre: string;
  // Etiquetas para los chips: "Pecho · Tríceps · Hombros".
  tags: string[];
  // Día de la semana al que está asignado · null = sin asignar.
  diaSemana: DayKey | null;
  ejercicios: Ejercicio[];
  // Minutos estimados · null si no se ha calculado.
  duracionMin: number | null;
  // Origen del DÍA entero (no de cada ejercicio). Si el user creó este
  // día desde cero, source='user' y la IA no lo borra al regenerar.
  source: SourceTag;
}

export interface PlanEntreno {
  // Días de la semana que entrena (1..7). El array tiene length === diasPorSemana.
  diasPorSemana: number;
  // Nombre legible · "Plan 4 días — Push/Pull/Legs".
  nombre: string;
  dias: DiaEntreno[];
}

// `1` | `2` | ... | `7` como claves para evitar colisiones de tipo.
export type PlanesEntreno = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, PlanEntreno>;

export interface Entrenos {
  planes: PlanesEntreno;
  // El plan que el user usa actualmente (1..7) · null = sin elegir aún.
  // Recomendación inicial = profile.diasEntreno.
  planActivo: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
}

// ────────────────────────────────────────────────────────────────────────────
// LISTA DE LA COMPRA
//
// 7 categorías fijas. Cada item tiene cantidad libre, precio estimado y
// flag de comprado. La lista la genera la IA a partir del menú o la
// rellena el user a mano.

export type CategoriaCompraKey =
  | 'proteinas'
  | 'lacteos'
  | 'hidratos'
  | 'frutas_verduras'
  | 'despensa'
  | 'grasas'
  | 'suplementacion';

export interface ItemCompra {
  nombre: string;
  cantidad: string; // "750g", "1 docena", "2 unidades"
  comprado: boolean;
  // Precio estimado en € · null si aún no se conoce.
  precio: number | null;
  source: SourceTag;
}

export type Compra = Record<CategoriaCompraKey, ItemCompra[]>;

// ────────────────────────────────────────────────────────────────────────────
// SUPLEMENTACIÓN
//
// Contadores de dosis restantes para que la tab Hoy avise cuando se está
// acabando algo. Cada uno es opcional · null = el user no toma ese suple.

// Configuración global del batido protéico · receta diaria que se replica
// en todos los días que el user marque como "tiene batido". La creatina
// puede ir DENTRO del batido (checkbox includeCreatina) en cuyo caso usa
// los mismos gramos que la creatina suelta · evita duplicar la dosis.
export interface BatidoConfig {
  gr_prot: number; // g de proteína · default 35
  // Si true · al añadir el batido a un día el user ya tiene cubierta la
  // dosis de creatina · el bloque creatina suelto no hace falta ese día.
  includeCreatina: boolean;
  extras: string; // texto libre · "+ 1 plátano + 300ml leche", opcional
  // Macros TOTALES del batido completo (proteína suplementaria + extras).
  // Lo introduce el user manualmente · lo mostramos en la mini-card del día.
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  // ── Datos del producto comprado · Sub-fase 2B.5.b ─────────────────
  // Nombre comercial del bote ("Whey Iso 100", "Optimum 100% Whey", …)
  // · se muestra en el bloque de suplementación de la lista de la
  // compra. Vacío = "Proteína" como placeholder genérico.
  producto_nombre: string;
  // Precio del bote en € · null = no definido. Junto con `gr_prot` y
  // `gr_total` permite calcular el coste por batido y proyectarlo a
  // mensual/anual (igual que v1 `renderCostSupl`).
  producto_precio: number | null;
}

// Configuración global de la creatina suelta (sin batido).
export interface CreatinaConfig {
  gr_dose: number; // g por dosis · default 3
  notas: string; // "con agua / antes del entreno", opcional
  // Producto comprado · igual estructura que BatidoConfig.
  producto_nombre: string;
  producto_precio: number | null;
}

// Override por-día de la mini-card de batido/creatina · permite que el user
// cambie hora y título solo para ese día sin tocar la receta global.
//   - hora · null = usa la hora default (batido 09:30 · creatina 19:30).
//   - titulo · null = usa el título default ("Batido Protéico" / "Creatina").
export interface SupDayOverride {
  hora: string | null; // HH:mm en 24h
  titulo: string | null;
}

export interface Suplementos {
  // ── Stock en GRAMOS (igual que el v1) ──────────────────────────────────
  // El stock se guarda en gramos (lo que pone el bote: "750g de whey")
  // y las dosis disponibles se calculan al vuelo dividiendo entre la
  // dosis de la receta (`batidoConfig.gr_prot` / `creatinaConfig.gr_dose`).
  // Razón: cuando compras un bote sabes los gramos exactos · saber "X
  // dosis" requiere calcular y la dosis puede cambiar en el futuro.
  // Cuando llegue Fase 2C (lista de la compra) estos campos se
  // alimentarán automáticamente de la suma de gramos de los productos
  // del apartado "Suplementación" · de momento se editan a mano desde
  // el modal de stock. null = sin definir todavía.
  batido_stock_gramos: number | null;
  creatina_stock_gramos: number | null;
  // Receta global del batido y de la creatina · una sola "config" replicada
  // en cada día que se marque. Editable desde MenuPage → ⚙ Configurar.
  batidoConfig: BatidoConfig;
  creatinaConfig: CreatinaConfig;
  // Días que tienen el batido/creatina añadido como "comida extra" del día.
  // Usamos arrays de DayKey en lugar de Record<DayKey, boolean> · más sencillo
  // de serializar, y en Firestore queda como un array nativo limpio.
  daysWithBatido: DayKey[];
  daysWithCreatina: DayKey[];
  // Overrides por-día (hora + título). Llave = DayKey, valor = override.
  // Si una entrada falta o tiene null en un campo, se cae a los defaults.
  // Esto permite que el lunes el batido sea "Pre-entreno · 07:30" y el
  // miércoles "Después del gym · 19:00" sin tocar la receta global.
  batidoOverrides: Partial<Record<DayKey, SupDayOverride>>;
  creatinaOverrides: Partial<Record<DayKey, SupDayOverride>>;
  // ── Contadores de tomas · Sub-fase 2B.5.b ──────────────────────────────
  // Acumulado histórico · suben con cada "Tomar" desde HoyPage. Se resetean
  // solo manualmente desde los modales del bloque Suplementación.
  batidos_tomados_total: number;
  creatinas_tomadas_total: number;
  // Tanto batido como creatina llevan contadores semanales y mensuales.
  // Auto-reset cuando cambia la ISO week / mes calendar (lo aplica
  // ProfileProvider.maybeResetSupCounters al cargar el doc). El user
  // también puede resetear manualmente desde el modal de stock.
  batidos_tomados_semana: number;
  batidos_tomados_mes: number;
  // Total este año · auto-reset el 1 de enero (año natural · 1 enero -
  // 31 diciembre del año en curso). Igual que semana/mes, los gestiona
  // `maybeResetSupCounters` cuando cambia el año al cargar el doc.
  batidos_tomados_anio: number;
  creatinas_tomadas_semana: number;
  creatinas_tomadas_mes: number;
  creatinas_tomadas_anio: number;
  // ms epoch del inicio del ciclo actual · null = nunca arrancado. Solo
  // informativo · lo mostramos en el modal para que el user vea desde
  // cuándo se acumula el contador semanal/mensual/anual. Lo actualiza
  // la primera vez que el user marca tomado (o al hacer reset manual).
  batido_semana_inicio: number | null;
  batido_mes_inicio: number | null;
  batido_anio_inicio: number | null;
  creatina_semana_inicio: number | null;
  creatina_mes_inicio: number | null;
  creatina_anio_inicio: number | null;
  // Última fecha (formato YYYY-MM-DD) en la que el user marcó el batido
  // / la creatina como "tomado hoy" desde HoyPage. null = no marcado.
  // Replica la lógica del v1: solo se puede marcar UNA vez al día y se
  // puede cancelar (descontando 1 dosis del contador y devolviendo los
  // gramos al stock). Comparamos contra `todayDateStr()` para saber si
  // está tomado en el día activo.
  //
  // Por qué fecha completa y no DayKey: el v1 guardaba 'lun'/'mar'/...
  // pero eso falla la semana siguiente (el siguiente lunes parece ya
  // tomado). Con YYYY-MM-DD el comportamiento es estricto y correcto.
  last_batido_date: string | null;
  last_creatina_date: string | null;
  // Espacio para crecer · vitamina D, omega-3, etc. en futuras versiones.
}

// Hora default cuando el override no la fija. La elegimos para que en el
// orden por hora del menú la mini-card caiga lógica:
//   - Batido a las 09:30 → entre desayuno (08:00) y comida (14:00)
//   - Creatina a las 19:30 → entre merienda (17:30) y cena (21:00)
export const SUP_HORA_DEFECTO = {
  batido: '09:30',
  creatina: '19:30',
} as const;

// Título default de la mini-card cuando el override no lo fija.
export const SUP_TITULO_DEFECTO = {
  batido: 'Batido Protéico',
  creatina: 'Creatina',
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Cálculos derivados de Suplementos · Sub-fase 2B.5.b
//
// Réplica de la lógica `renderSupl`/`recomputeAll` del v1. El stock se
// guarda en gramos y las dosis/batidos se calculan al vuelo. Detalles
// importantes que copia este módulo del v1:
//
//   1. El stock NO se descuenta al marcar tomado · solo cambia cuando
//      el user lo edita (manualmente o, en Fase 2C, desde la lista de
//      la compra cuando se rellenen productos de suplementación).
//   2. El "consumido" se calcula como `tomados × dosis` (gramos
//      derivados de los contadores · no almacenados).
//   3. Si `includeCreatina`, los batidos comparten stock con la
//      creatina suelta. Las dosis sueltas YA tomadas reservan gramos
//      del bote de creatina y reducen los batidos posibles.

export interface SupCalc {
  // Cuántas dosis/batidos se pueden hacer en TOTAL con el stock comprado
  // (asumiendo 0 tomados). null si el user no ha definido stock todavía.
  posibles: number | null;
  // Restantes = posibles − tomados (mínimo 0).
  restantes: number | null;
  // Gramos consumidos hasta ahora (tomados × dosis). Útil para el
  // tracker "Consumido: X g" del bloque suplementación de la lista de
  // la compra (Fase 2C). null si stock no definido.
  gramosConsumidos: number | null;
  // Gramos que quedan en el bote (stock − consumido). Mínimo 0.
  gramosRestantes: number | null;
}

// Cuántos batidos posibles considerando tanto el stock de proteína como,
// si `includeCreatina`, el stock de creatina ya reservado por las dosis
// sueltas que el user tomó. Equivalente a v1:
//
//   const creatRemForBatidos = max(0, creatStock - creatUsedByDirect);
//   totalPosibles = min(floor(protStock / protDosis),
//                       floor(creatRemForBatidos / creatDosis));
function calcBatidosPosiblesInternal(sup: Suplementos): number | null {
  const protStock = sup.batido_stock_gramos;
  if (protStock === null || sup.batidoConfig.gr_prot <= 0) return null;
  const protPosibles = Math.floor(protStock / sup.batidoConfig.gr_prot);
  if (!sup.batidoConfig.includeCreatina) return protPosibles;
  const creatStock = sup.creatina_stock_gramos;
  if (creatStock === null) {
    // includeCreatina=true pero sin stock de creatina · no se pueden
    // hacer batidos hasta que el user lo defina.
    return 0;
  }
  if (sup.creatinaConfig.gr_dose <= 0) return protPosibles;
  // Reservamos los gramos consumidos por dosis sueltas tomadas.
  const creatUsedByDirect =
    sup.creatinas_tomadas_total * sup.creatinaConfig.gr_dose;
  const creatRemForBatidos = Math.max(0, creatStock - creatUsedByDirect);
  const creatPosibles = Math.floor(
    creatRemForBatidos / sup.creatinaConfig.gr_dose,
  );
  return Math.min(protPosibles, creatPosibles);
}

export function calcBatidoStats(sup: Suplementos): SupCalc {
  const posibles = calcBatidosPosiblesInternal(sup);
  const protStock = sup.batido_stock_gramos;
  const grProt = sup.batidoConfig.gr_prot;
  if (posibles === null || protStock === null) {
    return {
      posibles: null,
      restantes: null,
      gramosConsumidos: null,
      gramosRestantes: null,
    };
  }
  const consumidos = sup.batidos_tomados_total * grProt;
  return {
    posibles,
    restantes: Math.max(0, posibles - sup.batidos_tomados_total),
    gramosConsumidos: consumidos,
    gramosRestantes: Math.max(0, protStock - consumidos),
  };
}

export function calcCreatinaStats(sup: Suplementos): SupCalc {
  const stock = sup.creatina_stock_gramos;
  const grCreat = sup.creatinaConfig.gr_dose;
  if (stock === null || grCreat <= 0) {
    return {
      posibles: null,
      restantes: null,
      gramosConsumidos: null,
      gramosRestantes: null,
    };
  }
  // El stock de creatina lo consumen tanto las dosis sueltas como los
  // batidos (si includeCreatina). El v1 calcula `creatUsed = batidos *
  // creatDosis + creatinasSolas * creatDosis` y muestra eso como
  // "Consumido". Replicamos exactamente.
  const usadoPorBatidos = sup.batidoConfig.includeCreatina
    ? sup.batidos_tomados_total * grCreat
    : 0;
  const usadoPorDirect = sup.creatinas_tomadas_total * grCreat;
  const consumidos = usadoPorBatidos + usadoPorDirect;
  // Posibles dosis sueltas considerando lo ya consumido por batidos
  // (equivale a v1: `creatRemForDosis = creatStock - creatUsedByBatido`).
  const creatRemForDosis = Math.max(0, stock - usadoPorBatidos);
  const posibles = Math.floor(creatRemForDosis / grCreat);
  return {
    posibles,
    restantes: Math.max(0, posibles - sup.creatinas_tomadas_total),
    gramosConsumidos: consumidos,
    gramosRestantes: Math.max(0, stock - consumidos),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// MONETIZACIÓN E IA · plan + límites de generación
//
// Modelo de negocio (decidido en Fase 2A):
//   - Free        · 1 generación al mes (total, no por sección)
//   - Pago único  · 4,99€ → adelanta 1 generación extra YA (caduca a los 30d)
//   - Pro         · 9,99€/mes → generaciones ilimitadas mientras esté activo
//
// La regeneración GRANULAR (solo menú, solo entrenos) cuenta como 1 gen
// completa en Free → opción 1 estricta. Esto es decisión de producto.
//
// La compra NO se regenera con IA — se deriva automáticamente del menú
// (ingredientes agregados por categoría). El user puede añadir productos
// extra a la lista (suplementos, despensa, etc.) que no provienen del menú.

export type PlanTipo = 'free' | 'one_off' | 'pro';

export interface PlanIA {
  tipo: PlanTipo;
  // Para 'one_off' y 'pro': ms epoch en que caduca el beneficio.
  // - 'free': null (no caduca, siempre activo)
  // - 'one_off': now + 30 días al pagar
  // - 'pro': now + 30 días, renovable mensualmente vía webhook Stripe
  vence_en: number | null;
  // Solo aplica a 'one_off' · marca si ya gastó la gen extra del pago.
  one_off_consumido: boolean;
}

// Scope de una regeneración IA. La compra NO está aquí porque no se
// regenera con IA, se deriva del menú.
export type ScopeIA = 'all' | 'menu' | 'entrenos';

export interface GeneracionesIA {
  // Última generación de cada scope · ms epoch o null si nunca.
  // Lo lee la UI para mostrar "Última generación: hace X días" en cada tab.
  menu_at: number | null;
  entrenos_at: number | null;
  // Generaciones consumidas en el ciclo actual. La Cloud Function
  // `generatePlan` lo incrementa al ejecutar y resetea cada 30 días.
  // En Free: máx 1. En Pro: ignorado (función no comprueba límite).
  consumidas_ciclo: number;
  // Inicio del ciclo actual · ms epoch.
  // Si now - ciclo_inicio > 30d, la Cloud Function resetea consumidas_ciclo
  // y avanza ciclo_inicio antes de comprobar el límite.
  ciclo_inicio: number;
}

export function defaultPlan(): PlanIA {
  return { tipo: 'free', vence_en: null, one_off_consumido: false };
}

export function defaultGeneraciones(): GeneracionesIA {
  return {
    menu_at: null,
    entrenos_at: null,
    consumidas_ciclo: 0,
    ciclo_inicio: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────

export interface UserDocument {
  profile: UserProfile;

  // Preferencias UI (sistema de unidades, inicio de semana). Optional —
  // se rellenan en cuanto el usuario las toca en Settings (o se migran
  // automáticamente desde localStorage la primera vez que un invitado
  // se hace cuenta real). Si está undefined, los consumidores caen a
  // DEFAULT_PREFERENCES.
  preferences?: Preferences;

  // ── Datos de la app (Fase 2 en adelante) ──
  // Estos campos contienen TODA la información que cada tab del shell v2
  // muestra al usuario. En modo manual los rellena el user; en modo IA
  // los rellena la Cloud Function `generatePlan` que llama a Gemini.
  // En invitado se pre-cargan con `demoUser` para que la app se entienda
  // de un vistazo.
  menu: Menu;
  entrenos: Entrenos;
  compra: Compra;
  suplementos: Suplementos;

  // ── Monetización + IA (gestionados desde Cloud Functions, no cliente) ──
  // Estado del plan de pago. La Cloud Function `stripeWebhook` lo actualiza
  // al recibir eventos de Stripe (compra única, suscripción nueva, cancelación).
  plan: PlanIA;
  // Rastreo granular de generaciones por scope (menú, entrenos) + contador
  // del ciclo de 30 días. La Cloud Function `generatePlan` lo gestiona.
  generaciones: GeneracionesIA;

  // ── Campos legacy · DEPRECATED ──
  // Se mantienen por retrocompatibilidad con docs anteriores a Fase 2A.
  // La Cloud Function `generatePlan` los actualiza junto con los nuevos
  // mientras existan docs migrándose. Eliminar en Fase 6 cuando todos
  // los docs estén migrados con `plan` y `generaciones`.
  /** @deprecated usar `plan.tipo === 'pro'` */
  plan_pro: boolean;
  /** @deprecated usar `plan.vence_en` */
  fecha_expiracion: number | null;
  /** @deprecated usar `generaciones.menu_at` o `generaciones.entrenos_at` */
  fecha_ultima_generacion: number | null;

  // Metadata
  createdAt: number; // ms epoch — set en la primera escritura
  lastActive: number; // ms epoch — actualizado al entrar al dashboard

  // Aviso médico/legal (roadmap 14-2). Se rellena con el timestamp en
  // que el usuario aceptó el disclaimer en el paso 1 del onboarding.
  // Valor null en docs antiguos sin aceptación registrada — la app
  // pedirá re-aceptación en futuras versiones si se necesita evidencia.
  medicalDisclaimerAcceptedAt: number | null;

  // Marca al doc como sembrado con `demoUser` (modo prueba). Útil para
  // mostrar el banner "Modo prueba — datos no permanentes" sin tener
  // que mirar `user.isAnonymous` desde Auth en cada tab.
  isDemo?: boolean;
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
    notas: '',
    intolerancias: [],
    alergias: [],
    alimentosProhibidos: [],
    alimentosObligatorios: [],
    ingredientesFavoritos: [],
    objetivoKcal: null,
    modo: 'manual',
    aiScope: null,
    completed: false,
  };
}

// ── Factories vacías (manual) ──
// Devuelven la estructura completa pero sin datos. Punto de partida para
// usuarios nuevos en cualquier modo (IA o manual). En modo IA se llenan
// con la respuesta de Gemini; en manual el user va rellenando.

export const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
export const MEAL_KEYS: MealKey[] = ['desayuno', 'comida', 'merienda', 'cena'];

export const HORA_DEFECTO: Record<MealKey, string> = {
  desayuno: '08:00',
  comida: '14:00',
  merienda: '17:30',
  cena: '21:00',
};

export const CATEGORIAS_COMPRA: { key: CategoriaCompraKey; label: string; emoji: string }[] = [
  { key: 'proteinas', label: 'Proteínas', emoji: '💪' },
  { key: 'lacteos', label: 'Lácteos', emoji: '🥛' },
  { key: 'hidratos', label: 'Hidratos', emoji: '🌾' },
  { key: 'frutas_verduras', label: 'Frutas y verduras', emoji: '🥦' },
  { key: 'despensa', label: 'Despensa', emoji: '🛒' },
  { key: 'grasas', label: 'Grasas', emoji: '🥑' },
  { key: 'suplementacion', label: 'Suplementación', emoji: '🧪' },
];

function emptyComida(meal: MealKey): Comida {
  return {
    alimentos: [],
    hora: HORA_DEFECTO[meal],
    kcal: 0,
    prot: 0,
    carb: 0,
    fat: 0,
    source: 'default',
  };
}

export function defaultMenu(): Menu {
  const out = {} as Menu;
  for (const day of DAY_KEYS) {
    out[day] = {
      desayuno: emptyComida('desayuno'),
      comida: emptyComida('comida'),
      merienda: emptyComida('merienda'),
      cena: emptyComida('cena'),
      extras: [],
    };
  }
  return out;
}

// Devuelve los 7 planes (1..7 días) con sus días vacíos y nombres genéricos.
// La distribución mínima viable es Empuje/Tirón/Pierna y descansos. La IA
// cuando llegue refinará nombres/tags/ejercicios según objetivo.
export function defaultEntrenos(): Entrenos {
  // Genera N días vacíos con letra (A, B, C, ...). Sin diaSemana asignado.
  const emptyDias = (n: number): DiaEntreno[] => {
    const letras = 'ABCDEFG';
    return Array.from({ length: n }, (_, i) => ({
      letra: letras[i],
      nombre: `Día ${letras[i]}`,
      tags: [],
      diaSemana: null,
      ejercicios: [],
      duracionMin: null,
      source: 'default' as SourceTag,
    }));
  };

  const planes: PlanesEntreno = {
    1: { diasPorSemana: 1, nombre: 'Plan 1 día', dias: emptyDias(1) },
    2: { diasPorSemana: 2, nombre: 'Plan 2 días', dias: emptyDias(2) },
    3: { diasPorSemana: 3, nombre: 'Plan 3 días', dias: emptyDias(3) },
    4: { diasPorSemana: 4, nombre: 'Plan 4 días', dias: emptyDias(4) },
    5: { diasPorSemana: 5, nombre: 'Plan 5 días', dias: emptyDias(5) },
    6: { diasPorSemana: 6, nombre: 'Plan 6 días', dias: emptyDias(6) },
    7: { diasPorSemana: 7, nombre: 'Plan 7 días', dias: emptyDias(7) },
  };
  return { planes, planActivo: null };
}

export function defaultCompra(): Compra {
  return {
    proteinas: [],
    lacteos: [],
    hidratos: [],
    frutas_verduras: [],
    despensa: [],
    grasas: [],
    suplementacion: [],
  };
}

// Receta del batido por defecto · 35g de whey + creatina dentro · macros
// aproximados de un batido isolate medio. El user los puede ajustar desde
// el modal "⚙ Configurar".
export function defaultBatidoConfig(): BatidoConfig {
  return {
    gr_prot: 35,
    includeCreatina: true,
    extras: '',
    kcal: 145,
    prot: 30,
    carb: 4,
    fat: 1,
    producto_nombre: '',
    producto_precio: null,
  };
}

export function defaultCreatinaConfig(): CreatinaConfig {
  return {
    gr_dose: 3,
    notas: '',
    producto_nombre: '',
    producto_precio: null,
  };
}

export function defaultSuplementos(): Suplementos {
  return {
    batido_stock_gramos: null,
    creatina_stock_gramos: null,
    batidoConfig: defaultBatidoConfig(),
    creatinaConfig: defaultCreatinaConfig(),
    daysWithBatido: [],
    daysWithCreatina: [],
    batidoOverrides: {},
    creatinaOverrides: {},
    batidos_tomados_total: 0,
    creatinas_tomadas_total: 0,
    batidos_tomados_semana: 0,
    batidos_tomados_mes: 0,
    batidos_tomados_anio: 0,
    creatinas_tomadas_semana: 0,
    creatinas_tomadas_mes: 0,
    creatinas_tomadas_anio: 0,
    batido_semana_inicio: null,
    batido_mes_inicio: null,
    batido_anio_inicio: null,
    creatina_semana_inicio: null,
    creatina_mes_inicio: null,
    creatina_anio_inicio: null,
    last_batido_date: null,
    last_creatina_date: null,
  };
}

export function defaultUserDocument(): UserDocument {
  const now = Date.now();
  return {
    profile: defaultProfile(),
    menu: defaultMenu(),
    entrenos: defaultEntrenos(),
    compra: defaultCompra(),
    suplementos: defaultSuplementos(),
    plan: defaultPlan(),
    generaciones: defaultGeneraciones(),
    plan_pro: false,
    fecha_expiracion: null,
    fecha_ultima_generacion: null,
    createdAt: now,
    lastActive: now,
    medicalDisclaimerAcceptedAt: null,
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

// Opciones de scope IA — etiquetas humanas + descripción.
// Reusadas en StepMode (onboarding y modal de cambio) y en AiGenerateModal
// (modal del botón "Generar con IA" de cada tab). El emoji está pensado
// para no depender de Ionicons en el flujo de onboarding (más rápido de
// renderizar) — los modales pueden mapearlo a un IonIcon si quieren.
export const AI_SCOPE_OPTIONS: {
  value: AiScopeChoice;
  label: string;
  sub: string;
  emoji: string;
}[] = [
  {
    value: 'all',
    label: 'Todo el plan',
    sub: 'Menú semanal con su lista de la compra y plan de entreno.',
    emoji: '✨',
  },
  {
    value: 'menu_compra',
    label: 'Menú + lista de compra',
    sub: 'Solo nutrición. El plan de entreno lo rellenas tú.',
    emoji: '🍽️',
  },
  {
    value: 'menu_only',
    label: 'Solo menú',
    sub: 'Recetas semanales sin generar la lista de la compra.',
    emoji: '📋',
  },
  {
    value: 'entrenos_only',
    label: 'Solo entrenos',
    sub: 'Plan de entrenamiento. La nutrición la rellenas tú.',
    emoji: '🏋️',
  },
];

// Helper: filtra AI_SCOPE_OPTIONS por las opciones disponibles en un
// contexto concreto (Hoy = todas, Menú = 2, Entreno = 1).
export function aiScopeOptions(values: AiScopeChoice[]) {
  return AI_SCOPE_OPTIONS.filter((o) => values.includes(o.value));
}

// ────────────────────────────────────────────────────────────────────────────
// Catálogos para los selectores de alergias / intolerancias del paso 4 del
// onboarding y de EditFitnessProfileModal. Se almacenan en perfil como
// strings — los predefinidos como su `value`, los que el user añade a mano
// como texto libre.

// Los 14 alérgenos del Reglamento UE 1169/2011 (declaración obligatoria
// en alimentación). Cubren el ~90% de casos en España.
export const ALERGIAS_COMUNES: { value: string; label: string }[] = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lacteos', label: 'Lácteos' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'pescado', label: 'Pescado' },
  { value: 'crustaceos', label: 'Crustáceos' },
  { value: 'moluscos', label: 'Moluscos' },
  { value: 'frutos_secos', label: 'Frutos secos' },
  { value: 'cacahuetes', label: 'Cacahuetes' },
  { value: 'soja', label: 'Soja' },
  { value: 'apio', label: 'Apio' },
  { value: 'mostaza', label: 'Mostaza' },
  { value: 'sesamo', label: 'Sésamo' },
  { value: 'sulfitos', label: 'Sulfitos' },
  { value: 'altramuces', label: 'Altramuces (lupino)' },
];

// Intolerancias frecuentes que NO son alergias técnicamente (no implican
// reacción inmunológica). El user puede añadir las que no estén aquí
// como texto libre.
export const INTOLERANCIAS_COMUNES: { value: string; label: string }[] = [
  { value: 'lactosa', label: 'Lactosa' },
  { value: 'fructosa', label: 'Fructosa' },
  { value: 'sorbitol', label: 'Sorbitol' },
  { value: 'histamina', label: 'Histamina' },
  { value: 'sacarosa', label: 'Sacarosa' },
  { value: 'gluten_no_celiaca', label: 'Gluten (no celíaca)' },
  { value: 'fodmap', label: 'FODMAP' },
];

// Helper: dado un value (predefinido o texto libre), devuelve el label
// legible. Si no está en la lista predefinida, devuelve el value tal cual.
export function alergiaLabel(value: string): string {
  return ALERGIAS_COMUNES.find((a) => a.value === value)?.label ?? value;
}

export function intoleranciaLabel(value: string): string {
  return INTOLERANCIAS_COMUNES.find((a) => a.value === value)?.label ?? value;
}
