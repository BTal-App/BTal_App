import { createContext } from 'react';
import type {
  BatidoConfig,
  CategoriaCompra,
  Comida,
  ComidaExtra,
  ComidasDelDia,
  CreatinaConfig,
  DayKey,
  DiaEntreno,
  ItemCompra,
  MealKey,
  PlanEntreno,
  SupDayOverride,
  UserDocument,
  UserProfile,
} from '../templates/defaultUser';

export interface ProfileState {
  // null = aún no cargado · UserDocument | null = cargado (puede ser null si
  // el usuario no tiene documento todavía — caso onboarding pendiente).
  profile: UserDocument | null;
  loading: boolean;
  error: string | null;

  // Refresca el documento del usuario desde Firestore.
  refresh: () => Promise<void>;

  // Guarda el perfil de onboarding (crea o actualiza el doc completo).
  saveOnboarding: (profile: UserProfile) => Promise<void>;

  // Actualiza solo algunos campos del perfil ya existente (Settings →
  // "Editar datos del perfil"). No toca `completed` ni el resto del doc.
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;

  // Actualiza una comida del menú (`menu.{day}.{meal}`). Usado desde el
  // editor inline (Sub-fase 2B.3). Marca automáticamente source='user'
  // a menos que el partial incluya source explícito. Optimistic update
  // local + revert si Firestore falla.
  updateMeal: (
    day: DayKey,
    meal: MealKey,
    partial: Partial<Comida>,
  ) => Promise<void>;

  // Duplica el contenido de una comida (srcDay, meal) a varios días destino
  // manteniendo la misma meal-key. Sub-fase 2B.4 · usado desde MealSheet.
  // Optimistic update sobre todos los destinos + revert por destino si la
  // escritura remota falla.
  duplicateMeal: (
    srcDay: DayKey,
    meal: MealKey,
    destDays: DayKey[],
  ) => Promise<void>;

  // Suplementación · Sub-fase 2B.5.a. Setean la receta global del batido /
  // creatina (no es por-día) y togglean si un día concreto tiene esa
  // suplementación añadida como "comida extra". Optimistic update + revert.
  setBatidoConfig: (config: BatidoConfig) => Promise<void>;
  setCreatinaConfig: (config: CreatinaConfig) => Promise<void>;
  toggleSupInDay: (
    kind: 'batido' | 'creatina',
    day: DayKey,
    on: boolean,
  ) => Promise<void>;

  // Vacía una comida (alimentos=[], macros=0, hora=default). Devuelve el
  // snapshot de lo que había para que el caller pueda implementar undo.
  clearMeal: (day: DayKey, meal: MealKey) => Promise<Comida | null>;

  // Restaura una comida a partir del snapshot devuelto por clearMeal.
  // Usado para implementar el botón "Deshacer" del IonToast post-borrado.
  restoreMeal: (
    day: DayKey,
    meal: MealKey,
    snapshot: Comida,
  ) => Promise<void>;

  // Setea (o borra) el override per-día del batido/creatina · hora y
  // título personalizados para esa mini-card concreta. `override=null`
  // borra la entrada y la mini-card vuelve a usar los defaults.
  setSupOverride: (
    kind: 'batido' | 'creatina',
    day: DayKey,
    override: SupDayOverride | null,
  ) => Promise<void>;

  // ── Suplementación · contadores y stock · Sub-fase 2B.5.b ──────────
  // Setea el stock en GRAMOS · igual que el v1 (null = no definido).
  // El cliente calcula las dosis posibles al vuelo dividiendo por la
  // dosis configurada en `batidoConfig.gr_prot` / `creatinaConfig.gr_dose`.
  setSupStockGramos: (
    kind: 'batido' | 'creatina',
    gramos: number | null,
  ) => Promise<void>;
  // Marcar el batido como TOMADO HOY (igual que v1: 1 vez/día). Si ya
  // estaba marcado para hoy, no hace nada (idempotente). En otro caso
  // setea `last_batido_date` al día actual, +1 al total/semana/mes.
  marcarBatidoTomadoHoy: () => Promise<void>;
  // Cancelar el batido marcado HOY · resta 1 al total/semana/mes y
  // setea `last_batido_date = null`. No-op si no estaba marcado para hoy.
  cancelarBatidoTomadoHoy: () => Promise<void>;
  // Mismo patrón para creatina suelta.
  marcarCreatinaTomadaHoy: () => Promise<void>;
  cancelarCreatinaTomadaHoy: () => Promise<void>;
  // Counter manual ±1 (igual que v1 `changeBatidos` / `changeCreatinas`).
  // Modifica los contadores total/semana/mes pero NO toca `last_*_date`.
  // Útil para ajustes históricos: "olvidé cancelar ayer", "tomé dos
  // batidos hoy en lugar de uno", etc. Floor a 0.
  incrementarBatidoTomado: () => Promise<void>;
  decrementarBatidoTomado: () => Promise<void>;
  incrementarCreatinaTomada: () => Promise<void>;
  decrementarCreatinaTomada: () => Promise<void>;
  // Resets de contadores · tanto batido como creatina llevan ciclos
  // semanal/mensual/anual con auto-reset al cambiar de ISO week / mes /
  // año y reset manual desde el modal.
  resetBatidoSemanal: () => Promise<void>;
  resetBatidoMensual: () => Promise<void>;
  resetBatidoAnual: () => Promise<void>;
  resetBatidoTotal: () => Promise<void>;
  resetCreatinaSemanal: () => Promise<void>;
  resetCreatinaMensual: () => Promise<void>;
  resetCreatinaAnual: () => Promise<void>;
  resetCreatinaTotal: () => Promise<void>;
  // Aplica un parche directo a `suplementos` · usado para "Deshacer"
  // un reset semanal/mensual/anual restaurando el snapshot anterior.
  restoreSupValues: (
    patch: Partial<UserDocument['suplementos']>,
  ) => Promise<void>;

  // Comidas extras · Sub-fase 2B.5.b. Añade, actualiza o elimina una
  // ComidaExtra del día. Optimistic update + revert. addMealExtra valida
  // el límite MAX_EXTRAS_POR_DIA y lanza si se supera. removeMealExtra
  // devuelve el snapshot del extra borrado para implementar undo.
  addMealExtra: (day: DayKey, extra: ComidaExtra) => Promise<void>;
  updateMealExtra: (
    day: DayKey,
    id: string,
    partial: Partial<ComidaExtra>,
  ) => Promise<void>;
  removeMealExtra: (day: DayKey, id: string) => Promise<ComidaExtra | null>;
  restoreMealExtra: (day: DayKey, extra: ComidaExtra) => Promise<void>;

  // ── Flags por día del menú · Sub-fase 2B.6 ────────────────────────
  // Réplica del v1 (`weekend_excluded` / `days_hidden` localStorage):
  // excluir un día de la media semanal (sigue visible pero no se
  // promedia), ocultar un día (chip atenuado, lista reemplazada por
  // mensaje), o resetear las 4 comidas + extras del día al estado
  // por defecto. Optimistic update + revert si Firestore falla.
  toggleDayExcludedFromAvg: (day: DayKey) => Promise<void>;
  toggleDayHidden: (day: DayKey) => Promise<void>;
  // Reset al menú por defecto · invitados al demo, cuentas reales al
  // defaultMenu() (4 comidas vacías). Devuelve el snapshot de las
  // comidas previas por si se quiere implementar undo más adelante.
  resetDayMenu: (day: DayKey) => Promise<ComidasDelDia | null>;

  // ── Lista de la compra · Sub-fase 2C ──────────────────────────────
  // CRUD sobre items y categorías. Todas las acciones aplican
  // optimistic update y revierten al snapshot anterior si Firestore
  // falla. Las categorías builtIn (proteinas/lacteos/etc.) NO se
  // pueden eliminar pero sí renombrar/cambiar emoji/color.

  // Items dentro de una categoría
  addCompraItem: (catId: string, item: ItemCompra) => Promise<void>;
  updateCompraItem: (
    catId: string,
    itemId: string,
    partial: Partial<ItemCompra>,
  ) => Promise<void>;
  toggleCompraItemComprado: (
    catId: string,
    itemId: string,
  ) => Promise<void>;
  // Devuelve el item borrado (con su catId+índice) para implementar
  // undo desde el caller.
  removeCompraItem: (
    catId: string,
    itemId: string,
  ) => Promise<{ item: ItemCompra; index: number } | null>;
  restoreCompraItem: (
    catId: string,
    item: ItemCompra,
    index: number,
  ) => Promise<void>;
  // Resetea todos los `comprado` a false · todas las categorías.
  // Útil al empezar una semana nueva. Devuelve los items "marcados"
  // antes del reset para implementar undo.
  resetCompraChecks: () => Promise<void>;

  // Categorías personalizables
  addCompraCategoria: (cat: CategoriaCompra) => Promise<void>;
  updateCompraCategoria: (
    catId: string,
    partial: Partial<CategoriaCompra>,
  ) => Promise<void>;
  // Solo borra categorías custom · si es builtIn, lanza error.
  // Devuelve la categoría + sus items para implementar undo.
  removeCompraCategoria: (
    catId: string,
  ) => Promise<{ categoria: CategoriaCompra; items: ItemCompra[] } | null>;
  restoreCompraCategoria: (
    categoria: CategoriaCompra,
    items: ItemCompra[],
  ) => Promise<void>;
  // Reordena las categorías según un array de ids.
  reorderCompraCategorias: (orderedIds: string[]) => Promise<void>;

  // ── Entrenos · Sub-fase 2D ────────────────────────────────────────
  // CRUD sobre planes y días. Optimistic update + revert.

  // Plan activo
  setActivePlan: (planId: string) => Promise<void>;

  // Crea o reemplaza un plan completo · usado al guardar el editor de
  // plan (modo nuevo o edición). Si el id no existe, se crea.
  setPlanEntreno: (plan: PlanEntreno) => Promise<void>;

  // Borra un plan custom · si es builtIn lanza error. Devuelve el plan
  // borrado para implementar undo desde el caller (toast "Deshacer").
  removePlanEntreno: (planId: string) => Promise<PlanEntreno | null>;
  restorePlanEntreno: (plan: PlanEntreno) => Promise<void>;

  // Setea un día concreto dentro de un plan · más granular que
  // setPlanEntreno cuando solo cambia 1 día (ej. al editar desde el
  // DiaEditorModal). Optimistic update + revert.
  updateDiaEntreno: (
    planId: string,
    diaIdx: number,
    dia: DiaEntreno,
  ) => Promise<void>;
}

export const ProfileContext = createContext<ProfileState | null>(null);
