import { useEffect, useMemo, useRef, useState } from 'react';
import { useCountUp, useFirstVisible } from '../../utils/useCountUp';
import { useScrollTopOnEnter } from '../../utils/useScrollTopOnEnter';
import { horaToMinutes } from '../../utils/timeParser';
import {
  IonAlert,
  IonContent,
  IonPage,
  IonPopover,
  IonToast,
  useIonRouter,
  useIonViewDidEnter,
  useIonViewWillEnter,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { TabHeader } from '../../components/TabHeader';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { AiGenerateModal } from '../../components/AiGenerateModal';
import { AiGeneratedBadge } from '../../components/AiGeneratedBadge';
import { MealSheet } from '../../components/MealSheet';
import { MealEditorModal } from '../../components/MealEditorModal';
import { DuplicateMealModal } from '../../components/DuplicateMealModal';
import { BatidoInfoModal } from '../../components/BatidoInfoModal';
import { CreatinaInfoModal } from '../../components/CreatinaInfoModal';
import { SupCardEditor } from '../../components/SupCardEditor';
import { MealExtraEditorModal } from '../../components/MealExtraEditorModal';
import { DuplicateMealExtraModal } from '../../components/DuplicateMealExtraModal';
import { blurAndRun } from '../../utils/focus';
import { todayDateStr, todayKey } from '../../utils/dateKeys';
import { objetivoKcalEfectivo } from '../../utils/calorias';
import {
  DAY_KEYS,
  DAY_LABEL_FULL,
  DAY_LABEL_SHORT as DAY_LABEL,
  EXTRA_ICON_DEFAULT,
  HORA_DEFECTO,
  MAX_EXTRAS_POR_DIA,
  MEAL_ICON_DEFAULT,
  MEAL_KEYS,
  SUP_HORA_DEFECTO,
  SUP_TITULO_DEFECTO,
  type Comida,
  type ComidaExtra,
  type DayKey,
  type MealKey,
} from '../../templates/defaultUser';
import { MealIcon } from '../../components/MealIcon';
import './MenuPage.css';

// `DAY_LABEL` (corto) y `DAY_LABEL_FULL` viven en
// `templates/defaultUser.ts` · importados como alias arriba para
// mantener legibilidad del código existente.

// Etiquetas de las 4 comidas fijas (label). Los iconos de fallback
// viven en `MEAL_ICON_DEFAULT` (templates/defaultUser.ts) · se aplican
// vía `<MealIcon>` cuando `comida.emoji` es null.
const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

// Suma kcal/prot/carb/fat de TODO lo que hay en un día: 4 comidas fijas
// + extras + batido (si daysWithBatido.includes(day)). La creatina suelta
// NO suma macros (creatina monohidrato ≈ 0 kcal/100g) pero sí cuenta
// como "comida del día" para `comidasConDatos`. Réplica del v1
// recalcDayTotal/recalcWeeklyAvg ampliada para suplementos.
interface TotalesDia {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  comidasConDatos: number;
}
function calcTotalesDia(
  userDoc: import('../../templates/defaultUser').UserDocument,
  day: DayKey,
): TotalesDia {
  let kcal = 0, prot = 0, carb = 0, fat = 0, comidasConDatos = 0;
  const comidas = userDoc.menu[day];
  for (const meal of MEAL_KEYS) {
    const c = comidas[meal];
    if (!c) continue;
    kcal += c.kcal;
    prot += c.prot;
    carb += c.carb;
    fat += c.fat;
    if (c.alimentos.length > 0) comidasConDatos += 1;
  }
  // Extras del día · cuentan al total y al ring de progreso. Los
  // marcados como `deshabilitada` se saltan (mismo efecto que si no
  // existieran a efectos de totales · siguen visibles en la card,
  // atenuados en gris).
  for (const extra of comidas.extras) {
    if (extra.deshabilitada) continue;
    kcal += extra.kcal;
    prot += extra.prot;
    carb += extra.carb;
    fat += extra.fat;
    if (extra.alimentos.length > 0) comidasConDatos += 1;
  }
  // Suplementación · si el batido está añadido al día, sumamos sus
  // macros. La creatina suelta tiene 0 kcal (monohidrato puro) — solo
  // cuenta como comida adicional para el contador.
  const sup = userDoc.suplementos;
  if (sup.daysWithBatido.includes(day)) {
    kcal += sup.batidoConfig.kcal;
    prot += sup.batidoConfig.prot;
    carb += sup.batidoConfig.carb;
    fat += sup.batidoConfig.fat;
    comidasConDatos += 1;
  }
  if (sup.daysWithCreatina.includes(day)) {
    comidasConDatos += 1;
  }
  return { kcal, prot, carb, fat, comidasConDatos };
}

// Media semanal de los 4 macros · réplica del v1 recalcWeeklyAvg.
// Promedia los 7 días (lun..dom) sin filtrar — todos cuentan ya que en
// BTal aún no tenemos "excluir día" como en v1. Si no hay datos en
// ningún día, devuelve null para que la UI lo gestione (esconder o
// mostrar guion).
interface MediaSemanal {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}
function calcMediaSemanal(
  userDoc: import('../../templates/defaultUser').UserDocument | null,
): MediaSemanal | null {
  if (!userDoc) return null;
  // Filtramos los días excluidos manualmente (`menuFlags.excludedFromAvg`)
  // y los ocultos (`menuFlags.hidden`) — réplica del v1 recalcWeeklyAvg
  // que saltaba `data-excluded='1'` y `data-hidden='1'`. Si todos los
  // días están excluidos o el doc no tiene flags, fallback a los 7 días.
  const flags = userDoc.menuFlags;
  const excluded = new Set(flags?.excludedFromAvg ?? []);
  const hidden = new Set(flags?.hidden ?? []);
  const counted = DAY_KEYS.filter((d) => !excluded.has(d) && !hidden.has(d));
  // Si el user excluyó todos los días, evitamos dividir por 0.
  if (counted.length === 0) return null;
  let totK = 0, totP = 0, totC = 0, totF = 0;
  for (const day of counted) {
    const t = calcTotalesDia(userDoc, day);
    totK += t.kcal;
    totP += t.prot;
    totC += t.carb;
    totF += t.fat;
  }
  // Si no hay nada en ningún día contado, evitamos mostrar "0 kcal" engañoso.
  if (totK + totP + totC + totF === 0) return null;
  return {
    kcal: Math.round(totK / counted.length),
    prot: Math.round(totP / counted.length),
    carb: Math.round(totC / counted.length),
    fat: Math.round(totF / counted.length),
  };
}

// Alias del util compartido `horaToMinutes` (utils/timeParser.ts) ·
// mantenemos el nombre `horaAMinutos` local porque hay cinco callsites
// en este fichero y refactorarlos todos no aporta valor · el alias
// mantiene la huella de código mínima.
const horaAMinutos = horaToMinutes;

// Filas ordenadas por hora (4 comidas fijas + extras + posibles mini-cards
// de batido y creatina). Solo lee data del doc · los callbacks (abrir
// modal) se resuelven en el JSX donde tenemos acceso al state local.
type OrderedRow =
  | { kind: 'meal'; meal: MealKey; comida: Comida; sortMinutes: number }
  | { kind: 'extra'; extra: ComidaExtra; sortMinutes: number }
  | {
      kind: 'batido' | 'creatina';
      title: string;
      hora: string;
      desc: string;
      kcal?: number;
      prot?: number;
      carb?: number;
      fat?: number;
      sortMinutes: number;
    };

function buildOrderedRows(
  day: DayKey,
  userDoc: import('../../templates/defaultUser').UserDocument | null,
): OrderedRow[] {
  if (!userDoc) return [];
  const rows: OrderedRow[] = [];

  for (const meal of MEAL_KEYS) {
    const comida = userDoc.menu[day][meal];
    rows.push({
      kind: 'meal',
      meal,
      comida,
      sortMinutes: horaAMinutos(comida.hora ?? HORA_DEFECTO[meal]),
    });
  }

  // Extras del día · cada uno tiene su hora propia (o null → fin del día).
  for (const extra of userDoc.menu[day].extras) {
    rows.push({
      kind: 'extra',
      extra,
      sortMinutes: horaAMinutos(extra.hora),
    });
  }

  const sup = userDoc.suplementos;
  if (sup.daysWithBatido.includes(day)) {
    const ovr = sup.batidoOverrides[day];
    const hora = ovr?.hora ?? SUP_HORA_DEFECTO.batido;
    const titulo = ovr?.titulo ?? SUP_TITULO_DEFECTO.batido;
    const c = sup.batidoConfig;
    rows.push({
      kind: 'batido',
      title: titulo,
      hora,
      desc:
        `${c.gr_prot} g proteína`
        + (c.includeCreatina
          ? ` + ${sup.creatinaConfig.gr_dose} g creatina`
          : '')
        + (c.extras ? ` · ${c.extras}` : ''),
      kcal: c.kcal,
      prot: c.prot,
      carb: c.carb,
      fat: c.fat,
      sortMinutes: horaAMinutos(hora),
    });
  }
  if (sup.daysWithCreatina.includes(day)) {
    const ovr = sup.creatinaOverrides[day];
    const hora = ovr?.hora ?? SUP_HORA_DEFECTO.creatina;
    const titulo = ovr?.titulo ?? SUP_TITULO_DEFECTO.creatina;
    const c = sup.creatinaConfig;
    rows.push({
      kind: 'creatina',
      title: titulo,
      hora,
      desc: `${c.gr_dose} g por dosis` + (c.notas ? ` · ${c.notas}` : ''),
      sortMinutes: horaAMinutos(hora),
    });
  }

  // Sort estable por hora · ascendente. Si dos filas tienen la misma hora
  // (raro pero posible si el user pone batido a las 14:00 igual que comida),
  // el orden queda determinado por el orden en que las añadimos arriba.
  rows.sort((a, b) => a.sortMinutes - b.sortMinutes);
  return rows;
}

// Tab Menú · Sub-fase 2B.1 · UI de lectura. Día activo + ring de progreso
// + lista de 4 comidas. Sin edición todavía (Sub-fase 2B.2 abre detalle,
// 2B.3 añade editor inline).
const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);
  // `viewKey` se incrementa cada vez que la tab Menú se vuelve activa
  // (`ionViewWillEnter` de Ionic). Combinado con `selectedDay`, sirve
  // como `key` del WeeklyAverageCard para que React lo desmonte y
  // remonte → la animación count-up de la media semanal arranca otra
  // vez desde 0. Sin esto, el count-up solo se vería la primera vez
  // (después interpolaría del valor actual al nuevo).
  const [viewKey, setViewKey] = useState(0);
  useIonViewWillEnter(() => {
    setViewKey((k) => k + 1);
  });
  // Reset del scroll al top al volver a la tab Menú · evita que
  // vuelvas a la mitad de la lista de comidas si la dejaste así.
  const contentRef = useRef<HTMLIonContentElement>(null);
  useScrollTopOnEnter(contentRef);
  // MealSheet · null = cerrado · MealKey = abierta para esa comida del
  // día seleccionado. Cerrar = setear a null (ya hay onDidDismiss).
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);
  // MealSheet para extras · null = cerrado · ComidaExtra = abierto para
  // ese extra del día seleccionado. Mismo sheet que `openMeal` pero con
  // título/icon override y wired al editor + duplicate + delete de extras.
  const [openExtra, setOpenExtra] = useState<ComidaExtra | null>(null);
  // MealEditorModal · null = cerrado · MealKey = editando esa comida.
  // Cuando el user pulsa "Editar" en el sheet, cerramos el sheet y
  // abrimos este editor (no se solapan modales).
  const [editingMeal, setEditingMeal] = useState<MealKey | null>(null);
  // DuplicateMealModal · null = cerrado · MealKey = duplicando esa comida
  // del día seleccionado. Se abre desde MealSheet (botón "Duplicar").
  const [duplicatingMeal, setDuplicatingMeal] = useState<MealKey | null>(null);
  // Duplicar EXTRA · null = cerrado · ComidaExtra = duplicando ese
  // extra. Sheet → "Duplicar" cierra sheet + abre este modal.
  const [duplicatingExtra, setDuplicatingExtra] = useState<ComidaExtra | null>(
    null,
  );
  // Modales de suplementación · Sub-fase 2B.5.a.
  // - batidoOpen / creatinaOpen abren el modal info global (toolbar) ·
  //   contiene receta + macros + contadores inline.
  // - editingSup abre el editor de mini-card per-día (al pulsar la card).
  const [batidoOpen, setBatidoOpen] = useState(false);
  const [creatinaOpen, setCreatinaOpen] = useState(false);
  const [editingSup, setEditingSup] = useState<'batido' | 'creatina' | null>(
    null,
  );

  // Deep-link desde HoyPage: si llegamos con `?openSup=batido` o
  // `?openSup=creatina`, abrimos el modal correspondiente. Lo hacemos
  // en `useIonViewDidEnter` (no useEffect) para que el modal se abra
  // DESPUÉS de que la animación de transición de tabs haya terminado
  // · de lo contrario el modal aparece encima del slide a medio camino
  // y se siente como si la transición no existiera.
  const location = useLocation();
  const menuRouter = useIonRouter();
  useIonViewDidEnter(() => {
    const params = new URLSearchParams(location.search);
    const openSup = params.get('openSup');
    if (!openSup) return;
    if (openSup === 'batido') {
      setBatidoOpen(true);
    } else if (openSup === 'creatina') {
      setCreatinaOpen(true);
    }
    // Reemplaza la URL sin el query · evita re-abrir al recargar.
    menuRouter.push('/app/menu', 'none', 'replace');
  });
  const {
    clearMeal,
    restoreMeal,
    removeMealExtra,
    restoreMealExtra,
    updateMealExtra,
    toggleDayExcludedFromAvg,
    toggleDayHidden,
    resetDayMenu,
  } = useProfile();
  // IonAlert de confirmación al "Resetear día" · réplica del v1
  // mobileConfirm("Resetear día", "...se perderán los cambios locales").
  const [confirmResetDay, setConfirmResetDay] = useState<DayKey | null>(null);
  const [resetToastOpen, setResetToastOpen] = useState(false);
  // Modal del editor de extras · null = cerrado · objeto con kind decide modo.
  // - { mode: 'create' } → crea nuevo extra para selectedDay.
  // - { mode: 'edit', extra } → edita un extra existente.
  const [extraModal, setExtraModal] = useState<
    { mode: 'create' } | { mode: 'edit'; extra: ComidaExtra } | null
  >(null);

  // Estado para confirmar delete de extra · IonAlert + IonToast undo.
  const [pendingExtraDelete, setPendingExtraDelete] = useState<{
    day: DayKey;
    extra: ComidaExtra;
  } | null>(null);
  const [undoExtraSnapshot, setUndoExtraSnapshot] = useState<{
    day: DayKey;
    extra: ComidaExtra;
  } | null>(null);
  const undoExtraTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (undoExtraTimer.current) clearTimeout(undoExtraTimer.current);
    };
  }, []);

  const handleConfirmExtraDelete = async () => {
    if (!pendingExtraDelete) return;
    const { day, extra } = pendingExtraDelete;
    setPendingExtraDelete(null);
    try {
      const removed = await removeMealExtra(day, extra.id);
      if (!removed) return;
      if (undoExtraTimer.current) clearTimeout(undoExtraTimer.current);
      setUndoExtraSnapshot({ day, extra: removed });
      undoExtraTimer.current = setTimeout(() => {
        setUndoExtraSnapshot(null);
      }, 5000);
    } catch (err) {
      console.error('[BTal] removeMealExtra error:', err);
    }
  };

  // Confirmación previa al toggle deshabilitar/habilitar · IonAlert.
  // Solo se usa para EXTRAS. Snapshot del extra + del estado destino
  // (next = !current.deshabilitada) para que el mensaje del alert
  // pueda mostrar la acción concreta.
  const [pendingExtraToggle, setPendingExtraToggle] = useState<{
    day: DayKey;
    extra: ComidaExtra;
    next: boolean;
  } | null>(null);

  const handleConfirmExtraToggle = async () => {
    if (!pendingExtraToggle) return;
    const { day, extra, next } = pendingExtraToggle;
    setPendingExtraToggle(null);
    try {
      // Reusamos updateMealExtra · solo tocamos el flag `deshabilitada`.
      // No persistimos cambios de macros ni nombre · el resto del
      // objeto queda exactamente como estaba.
      await updateMealExtra(day, extra.id, { deshabilitada: next });
    } catch (err) {
      console.error('[BTal] toggle deshabilitada error:', err);
    }
  };

  const handleUndoExtraDelete = async () => {
    if (!undoExtraSnapshot) return;
    if (undoExtraTimer.current) clearTimeout(undoExtraTimer.current);
    const { day, extra } = undoExtraSnapshot;
    setUndoExtraSnapshot(null);
    try {
      await restoreMealExtra(day, extra);
    } catch (err) {
      console.error('[BTal] restoreMealExtra error:', err);
    }
  };

  // Validación previa al abrir el editor en modo crear · si ya hay 8
  // extras, mostramos toast en lugar de abrir el modal y que falle al
  // guardar (mejor feedback inmediato).
  const [limitToastOpen, setLimitToastOpen] = useState(false);
  const handleAddExtraPress = () => {
    const current = userDoc?.menu[selectedDay]?.extras.length ?? 0;
    if (current >= MAX_EXTRAS_POR_DIA) {
      setLimitToastOpen(true);
      return;
    }
    setExtraModal({ mode: 'create' });
  };
  // Eliminar comida · IonAlert de confirmación + IonToast con "Deshacer".
  // El alert se abre cuando el user pulsa el botón eliminar en MealSheet.
  // Tras confirmar, la comida se vacía y aparece el toast con timer 5s.
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MealKey | null>(null);
  // Undo state · cuando hay snapshot, el toast queda abierto con botón
  // "Deshacer". Si el user lo pulsa restauramos · si timeout, snapshot=null.
  const [undoSnapshot, setUndoSnapshot] = useState<{
    day: DayKey;
    meal: MealKey;
    comida: Comida;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const day = selectedDay;
    const meal = pendingDelete;
    setPendingDelete(null);
    setDeleteAlertOpen(false);
    try {
      const snapshot = await clearMeal(day, meal);
      if (!snapshot) return;
      // Cancelamos cualquier undo previo · el último delete gana.
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndoSnapshot({ day, meal, comida: snapshot });
      undoTimer.current = setTimeout(() => {
        setUndoSnapshot(null);
      }, 5000);
    } catch (err) {
      console.error('[BTal] clearMeal error:', err);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoSnapshot) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { day, meal, comida } = undoSnapshot;
    setUndoSnapshot(null);
    try {
      await restoreMeal(day, meal, comida);
    } catch (err) {
      console.error('[BTal] restoreMeal error:', err);
    }
  };

  const today = useMemo(() => todayKey(), []);
  const showAiButton =
    !!user && !user.isAnonymous && userDoc?.profile?.modo === 'ai';

  // Datos del día seleccionado (siempre 4 comidas — el schema lo garantiza).
  const comidasDelDia = userDoc?.menu?.[selectedDay];

  // Filas ordenadas (comidas + extras + suplementos) del día activo.
  // Memoizamos · `buildOrderedRows` es O(n) (4 comidas + extras +
  // batido/creatina) y se itera con .map() en el render. Sin memo se
  // recomputa en cada re-render del parent (open meal, edición, etc.)
  // creando un array nuevo cuyas claves cambian de identidad y fuerzan
  // a React a comparar todas las MealCard hijas. Las deps son las
  // únicas piezas que afectan al output.
  const orderedRows = useMemo(
    () => buildOrderedRows(selectedDay, userDoc),
    [selectedDay, userDoc],
  );
  const totales = useMemo<TotalesDia | null>(
    () => (userDoc ? calcTotalesDia(userDoc, selectedDay) : null),
    [userDoc, selectedDay],
  );

  // Media semanal de macros · v1 muestra esto al final del menú con
  // animación de bump al cambiar (recalcWeeklyAvg + animateNumber).
  const mediaSemanal = useMemo<MediaSemanal | null>(
    () => calcMediaSemanal(userDoc),
    [userDoc],
  );

  const objetivoKcal = useMemo(
    () => objetivoKcalEfectivo(userDoc?.profile),
    [userDoc?.profile],
  );

  return (
    <IonPage className="app-tab-page">
      <IonContent ref={contentRef} fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Plan "
            accent="nutricional"
            right={
              <>
                {showAiButton && (
                  <>
                    <AiGeneratedBadge userDoc={userDoc} scope="menu" />
                    <button
                      type="button"
                      className="tab-header-ia-btn"
                      onClick={blurAndRun(() => setAiGenOpen(true))}
                      aria-label="Generar con IA"
                    >
                      <MealIcon value="tb:sparkles" size={18} />
                      <span>Generar con IA</span>
                    </button>
                  </>
                )}
                <AppAvatarButton />
              </>
            }
          />

          {/* ── Day segment scrollable · chips marcados con clases
              `excluded` (no cuenta en media) y `hidden` (atenuado).
              Réplica v1 .day-tab.tab-hidden / data-excluded. ── */}
          <div className="menu-day-segment" role="tablist" aria-label="Días de la semana">
            {DAY_KEYS.map((day) => {
              const active = selectedDay === day;
              const isToday = day === today;
              const isExcluded = userDoc?.menuFlags?.excludedFromAvg.includes(day) ?? false;
              const isHidden = userDoc?.menuFlags?.hidden.includes(day) ?? false;
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={
                    DAY_LABEL_FULL[day]
                    + (isHidden ? ' · oculto' : '')
                    + (isExcluded ? ' · excluido del promedio' : '')
                  }
                  className={
                    'menu-day-chip'
                    + (active ? ' active' : '')
                    + (isToday ? ' today' : '')
                    + (isExcluded ? ' menu-day-chip--excluded' : '')
                    + (isHidden ? ' menu-day-chip--hidden' : '')
                  }
                  onClick={blurAndRun(() => setSelectedDay(day))}
                >
                  <span className="menu-day-chip-name">{DAY_LABEL[day]}</span>
                </button>
              );
            })}
          </div>

          {/* ── Day summary card · ring de progreso + totales ── */}
          {comidasDelDia && totales && (
            <DaySummary
              day={selectedDay}
              totales={totales}
              objetivoKcal={objetivoKcal}
            />
          )}

          {/* ── Sección Comidas · header con botón "+ Añadir" ──
               Inspirado en el preview v2 (BTal_NewVersionPreview):
               link "+ Añadir" inline a la derecha del título. */}
          <div className="app-section-title menu-section-title">
            <h2>Comidas · {DAY_LABEL_FULL[selectedDay]}</h2>
            <button
              type="button"
              className="menu-add-meal-btn"
              onClick={blurAndRun(handleAddExtraPress)}
              aria-label="Añadir comida nueva"
            >
              <MealIcon value="tb:plus" size={16} />
              <span>Añadir comida</span>
            </button>
          </div>

          {/* Toolbar de suplementos · Sub-fase 2B.5.a · Batido +
              Creatina con iconos Ionic (nutrition / medical) coherentes
              con el resto de la UI. Cuando el día activo los tiene
              añadidos, el botón cambia a verde y muestra ✓ inline al
              final del texto. */}
          {userDoc?.suplementos && (
            <div className="menu-sup-toolbar">
              <button
                type="button"
                className={
                  'menu-sup-btn menu-sup-btn--batido'
                  + (userDoc.suplementos.daysWithBatido.includes(selectedDay)
                    ? ' menu-sup-btn--has-it'
                    : '')
                }
                onClick={blurAndRun(() => setBatidoOpen(true))}
                aria-label="Batido protéico"
              >
                <span className="menu-sup-btn-label">
                  <MealIcon value="tb:cup" size={16} className="menu-sup-btn-icon" />
                  BATIDO
                  {userDoc.suplementos.daysWithBatido.includes(selectedDay)
                    ? ' ✓'
                    : ''}
                </span>
              </button>
              <button
                type="button"
                className={
                  'menu-sup-btn menu-sup-btn--creatina'
                  + (userDoc.suplementos.daysWithCreatina.includes(selectedDay)
                    ? ' menu-sup-btn--has-it'
                    : '')
                }
                onClick={blurAndRun(() => setCreatinaOpen(true))}
                aria-label="Creatina"
              >
                <span className="menu-sup-btn-label">
                  <MealIcon value="tb:ladle" size={16} className="menu-sup-btn-icon" />
                  CREATINA
                  {userDoc.suplementos.daysWithCreatina.includes(selectedDay)
                    ? ' ✓'
                    : ''}
                </span>
              </button>
            </div>
          )}

          {comidasDelDia
          && (userDoc?.menuFlags?.hidden.includes(selectedDay) ?? false) ? (
            // Día oculto · placeholder con CTA para volver a mostrarlo.
            // Réplica del v1 .day-content.day-hidden (sin la grid).
            <div className="menu-day-hidden-card">
              <div className="menu-day-hidden-info">
                <MealIcon value="tb:eye-off" size={20} />
                <div>
                  <span className="menu-day-hidden-title">
                    {DAY_LABEL_FULL[selectedDay]} está oculto
                  </span>
                  <span className="menu-day-hidden-sub">
                    Sus comidas siguen guardadas y no cuentan en la media
                    semanal. Puedes mostrarlo cuando quieras.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="menu-day-hidden-btn"
                onClick={() => {
                  toggleDayHidden(selectedDay).catch((err) =>
                    console.error('[BTal] toggleDayHidden:', err),
                  );
                }}
              >
                <MealIcon value="tb:eye" size={18} />
                Mostrar día
              </button>
            </div>
          ) : comidasDelDia ? (
            <div className="menu-meal-list">
              {/* Lista unificada de filas ordenadas por hora · combinamos
                  las 4 comidas del día y, si están añadidos, las mini-cards
                  de batido y creatina. La hora la lee del override → de la
                  comida → del default · garantiza orden estable. */}
              {orderedRows.map((row) => {
                if (row.kind === 'meal') {
                  return (
                    <MealCard
                      key={`meal-${row.meal}`}
                      meal={row.meal}
                      comida={row.comida}
                      onClick={() => setOpenMeal(row.meal)}
                    />
                  );
                }
                if (row.kind === 'extra') {
                  return (
                    <ExtraMealCard
                      key={`extra-${row.extra.id}`}
                      extra={row.extra}
                      // Antes abría el editor directamente · ahora abre
                      // el sheet de detalle (lectura + acciones), igual
                      // que las 4 fijas. Desde ahí se accede a edit /
                      // duplicar / borrar.
                      onClick={() => setOpenExtra(row.extra)}
                    />
                  );
                }
                // Solo marcamos "✓ TOMADO" si la card está en el día
                // de HOY (no en otros días) y `last_*_date` coincide.
                // Réplica de `meal-card-batido-taken` del v1.
                const todayStr = todayDateStr();
                const isToday = selectedDay === today;
                const supSection = userDoc?.suplementos;
                const takenToday =
                  isToday
                  && supSection !== undefined
                  && (row.kind === 'batido'
                    ? supSection.last_batido_date === todayStr
                    : supSection.last_creatina_date === todayStr);
                return (
                  <SupCard
                    key={`sup-${row.kind}`}
                    kind={row.kind}
                    title={row.title}
                    hora={row.hora}
                    desc={row.desc}
                    kcal={row.kcal}
                    prot={row.prot}
                    carb={row.carb}
                    fat={row.fat}
                    takenToday={takenToday}
                    // Pulsar la mini-card abre el editor del día (hora +
                    // título override + quitar del día). La receta global
                    // se edita desde los botones de la toolbar de arriba.
                    onClick={() => setEditingSup(row.kind)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="hoy-empty-card">
              <div className="hoy-empty-icon">
                <MealIcon value="tb:coffee" size={24} />
              </div>
              <div className="hoy-empty-info">
                <span className="hoy-empty-title">Cargando menú…</span>
                <span className="hoy-empty-sub">
                  Estamos sincronizando tus comidas con la base de datos.
                </span>
              </div>
            </div>
          )}

          {/* Total del día seleccionado · justo antes de la media
              semanal · 4 pills con kcal/prot/carb/fat sumando comidas
              + extras + batido (si está añadido al día). Cada número
              rebota con btal-anim-bump al cambiar. Réplica v1
              `.day-total` + `.day-total-macros` + menú ⋯ con 3 opciones. */}
          {comidasDelDia && totales && (
            <DayTotalCard
              day={selectedDay}
              totales={totales}
              isExcluded={
                userDoc?.menuFlags?.excludedFromAvg.includes(selectedDay) ?? false
              }
              isHidden={
                userDoc?.menuFlags?.hidden.includes(selectedDay) ?? false
              }
              onToggleExcluded={() => {
                toggleDayExcludedFromAvg(selectedDay).catch((err) =>
                  console.error('[BTal] toggleDayExcludedFromAvg:', err),
                );
              }}
              onToggleHidden={() => {
                toggleDayHidden(selectedDay).catch((err) =>
                  console.error('[BTal] toggleDayHidden:', err),
                );
              }}
              onReset={() => setConfirmResetDay(selectedDay)}
            />
          )}

          {/* Media semanal de macros · réplica v1 .macro-overview. Solo
              se muestra si hay al menos 1 día con datos. La `key`
              compuesta (selectedDay + viewKey) hace que el componente
              se remonte cada vez que cambias de día o entras a la tab
              MENÚ → la animación count-up de los números arranca
              desde 0 otra vez. */}
          {mediaSemanal && (
            <WeeklyAverageCard
              key={`${selectedDay}-${viewKey}`}
              avg={mediaSemanal}
            />
          )}

          <div className="app-tab-pad-bottom" />
        </div>

        {showAiButton && aiGenOpen && (
          <AiGenerateModal
            isOpen={aiGenOpen}
            onClose={() => setAiGenOpen(false)}
            title="Generar el menú con IA"
            description="¿Quieres también la lista de la compra?"
            availableScopes={['menu_compra', 'menu_only']}
            defaultScope={userDoc?.profile?.aiScope ?? undefined}
          />
        )}

        {/* Bottom sheet de detalle · solo se monta cuando hay una comida
            abierta. onEdit cierra el sheet y abre el MealEditorModal. */}
        {openMeal && comidasDelDia && (
          <MealSheet
            isOpen={openMeal !== null}
            onClose={() => setOpenMeal(null)}
            day={selectedDay}
            meal={openMeal}
            comida={comidasDelDia[openMeal]}
            onEdit={() => {
              // Cerrar sheet + abrir editor · evitamos modales solapados
              // y el editor tiene contexto completo del meal a editar.
              const m = openMeal;
              setOpenMeal(null);
              setEditingMeal(m);
            }}
            onDuplicate={() => {
              // Cerrar sheet + abrir DuplicateMealModal · evitamos modales
              // solapados y el modal duplica con el contexto del meal/día
              // seleccionado en este instante.
              const m = openMeal;
              setOpenMeal(null);
              setDuplicatingMeal(m);
            }}
            onDelete={() => {
              // Cerrar sheet + abrir IonAlert de confirmación. Tras confirmar
              // disparamos clearMeal y mostramos toast con "Deshacer" 5s.
              const m = openMeal;
              setOpenMeal(null);
              setPendingDelete(m);
              setDeleteAlertOpen(true);
            }}
          />
        )}

        {/* Sheet de detalle para EXTRAS · misma UX que el de las 4 fijas
            pero con título = `extra.nombre`, fallback icon = EXTRA, y chip
            "EXTRA" si está marcado. Las acciones cierran este sheet y
            abren los modales correspondientes (editor / duplicate /
            confirm delete). */}
        {openExtra && (
          <MealSheet
            isOpen={openExtra !== null}
            onClose={() => setOpenExtra(null)}
            day={selectedDay}
            comida={openExtra}
            title={openExtra.nombre.trim() || 'Comida'}
            iconFallback={EXTRA_ICON_DEFAULT}
            isExtra={openExtra.esExtra ?? true}
            isDisabled={!!openExtra.deshabilitada}
            onEdit={() => {
              const e = openExtra;
              setOpenExtra(null);
              setExtraModal({ mode: 'edit', extra: e });
            }}
            onDuplicate={() => {
              const e = openExtra;
              setOpenExtra(null);
              setDuplicatingExtra(e);
            }}
            onDelete={() => {
              const e = openExtra;
              setOpenExtra(null);
              setPendingExtraDelete({ day: selectedDay, extra: e });
            }}
            onToggleDisabled={() => {
              const e = openExtra;
              const next = !(e.deshabilitada ?? false);
              setOpenExtra(null);
              setPendingExtraToggle({ day: selectedDay, extra: e, next });
            }}
          />
        )}

        {/* Confirmación de eliminar · IonAlert estándar de Ionic. El user
            puede cancelar o confirmar; tras confirmar, lanzamos clearMeal. */}
        <IonAlert
          isOpen={deleteAlertOpen}
          onDidDismiss={() => setDeleteAlertOpen(false)}
          header="¿Eliminar la comida?"
          message={
            pendingDelete
              ? `Vamos a vaciar ${MEAL_LABEL[pendingDelete].toLowerCase()} del ${DAY_LABEL_FULL[selectedDay].toLowerCase()}. Tendrás 5 segundos para deshacer.`
              : ''
          }
          buttons={[
            {
              text: 'Cancelar',
              role: 'cancel',
              handler: () => setPendingDelete(null),
            },
            {
              text: 'Eliminar',
              role: 'destructive',
              handler: () => {
                handleConfirmDelete().catch((err) => {
                  console.error('[BTal] handleConfirmDelete unhandled:', err);
                });
              },
            },
          ]}
        />

        {/* Toast con "Deshacer" · solo abierto mientras undoSnapshot existe.
            Botón nativo del IonToast con role 'cancel' para que cierre el
            toast después del handler. duration=5000 cierra automático. */}
        <IonToast
          isOpen={undoSnapshot !== null}
          onDidDismiss={() => setUndoSnapshot(null)}
          message={
            undoSnapshot
              ? `${MEAL_LABEL[undoSnapshot.meal]} del ${DAY_LABEL_FULL[undoSnapshot.day].toLowerCase()} eliminada`
              : ''
          }
          duration={5000}
          position="bottom"
          color="medium"
          buttons={[
            {
              text: 'Deshacer',
              role: 'cancel',
              handler: () => {
                handleUndoDelete().catch((err) => {
                  console.error('[BTal] handleUndoDelete unhandled:', err);
                });
              },
            },
          ]}
        />

        {/* Editor de comida con autosave · Sub-fase 2B.3. */}
        {editingMeal && comidasDelDia && (
          <MealEditorModal
            isOpen={editingMeal !== null}
            onClose={() => setEditingMeal(null)}
            day={selectedDay}
            meal={editingMeal}
            comida={comidasDelDia[editingMeal]}
          />
        )}

        {/* Modales de suplementación · Sub-fase 2B.5.a. Reciben el día
            activo en este momento · al cerrar, los chequeos los hacen los
            modales contra el doc actualizado del provider. */}
        {batidoOpen && (
          <BatidoInfoModal
            isOpen={batidoOpen}
            onClose={() => setBatidoOpen(false)}
            day={selectedDay}
          />
        )}
        {creatinaOpen && (
          <CreatinaInfoModal
            isOpen={creatinaOpen}
            onClose={() => setCreatinaOpen(false)}
            day={selectedDay}
          />
        )}

        {/* Editor de comidas extras · Sub-fase 2B.5.b. Maneja crear y editar.
            En modo edit se le pasa onRequestDelete para que el botón
            "Eliminar" del editor delegue la confirmación + undo aquí. */}
        {extraModal && (
          <MealExtraEditorModal
            isOpen={extraModal !== null}
            onClose={() => setExtraModal(null)}
            day={selectedDay}
            extra={extraModal.mode === 'edit' ? extraModal.extra : null}
            onRequestDelete={
              extraModal.mode === 'edit'
                ? (extra) =>
                    setPendingExtraDelete({ day: selectedDay, extra })
                : undefined
            }
          />
        )}

        {/* Confirmación previa al toggle deshabilitar/habilitar de un
            extra. El mensaje cambia según `next` para que el user sepa
            exactamente qué acción está confirmando. */}
        <IonAlert
          isOpen={pendingExtraToggle !== null}
          onDidDismiss={() => setPendingExtraToggle(null)}
          header={
            pendingExtraToggle?.next
              ? '¿Deshabilitar la comida?'
              : '¿Habilitar la comida?'
          }
          message={
            pendingExtraToggle
              ? pendingExtraToggle.next
                ? `"${pendingExtraToggle.extra.nombre}" se quedará atenuada en gris y dejará de sumar al total del día y a la media semanal. Puedes volver a habilitarla cuando quieras.`
                : `"${pendingExtraToggle.extra.nombre}" volverá a contar al total del día y a la media semanal.`
              : ''
          }
          buttons={[
            {
              text: 'Cancelar',
              role: 'cancel',
              handler: () => setPendingExtraToggle(null),
            },
            {
              text: pendingExtraToggle?.next ? 'Deshabilitar' : 'Habilitar',
              role: 'confirm',
              handler: () => {
                handleConfirmExtraToggle().catch((err) => {
                  console.error('[BTal] handleConfirmExtraToggle unhandled:', err);
                });
              },
            },
          ]}
        />

        {/* Confirmación de eliminar extra · IonAlert + IonToast undo. */}
        <IonAlert
          isOpen={pendingExtraDelete !== null}
          onDidDismiss={() => setPendingExtraDelete(null)}
          header="¿Eliminar la comida?"
          message={
            pendingExtraDelete
              ? `Vamos a eliminar "${pendingExtraDelete.extra.nombre}" del ${DAY_LABEL_FULL[pendingExtraDelete.day].toLowerCase()}. Tendrás 5 segundos para deshacer.`
              : ''
          }
          buttons={[
            {
              text: 'Cancelar',
              role: 'cancel',
              handler: () => setPendingExtraDelete(null),
            },
            {
              text: 'Eliminar',
              role: 'destructive',
              handler: () => {
                handleConfirmExtraDelete().catch((err) => {
                  console.error('[BTal] handleConfirmExtraDelete unhandled:', err);
                });
              },
            },
          ]}
        />

        <IonToast
          isOpen={undoExtraSnapshot !== null}
          onDidDismiss={() => setUndoExtraSnapshot(null)}
          message={
            undoExtraSnapshot
              ? `"${undoExtraSnapshot.extra.nombre}" eliminada`
              : ''
          }
          duration={5000}
          position="bottom"
          color="medium"
          buttons={[
            {
              text: 'Deshacer',
              role: 'cancel',
              handler: () => {
                handleUndoExtraDelete().catch((err) => {
                  console.error('[BTal] handleUndoExtraDelete unhandled:', err);
                });
              },
            },
          ]}
        />

        {/* Toast de límite alcanzado al pulsar "+ Añadir" con 8 extras. */}
        <IonToast
          isOpen={limitToastOpen}
          onDidDismiss={() => setLimitToastOpen(false)}
          message={`Máximo ${MAX_EXTRAS_POR_DIA} comidas extras por día.`}
          duration={2500}
          position="bottom"
          color="warning"
        />

        {/* IonAlert · confirmación al "Resetear día" del DayTotalCard.
            Réplica del v1 mobileConfirm("Resetear día", "..."). El
            user pierde los cambios del día y vuelve a las comidas
            por defecto (demo para invitados, vacías para reales). */}
        <IonAlert
          isOpen={confirmResetDay !== null}
          onDidDismiss={() => setConfirmResetDay(null)}
          header="¿Resetear día?"
          message={
            confirmResetDay
              ? `Vamos a restaurar las 4 comidas del ${DAY_LABEL_FULL[confirmResetDay].toLowerCase()} al menú original. Se perderán los cambios que hayas hecho ese día. Esta acción no se puede deshacer.`
              : ''
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Resetear',
              role: 'destructive',
              handler: () => {
                if (!confirmResetDay) return;
                const day = confirmResetDay;
                resetDayMenu(day)
                  .then(() => setResetToastOpen(true))
                  .catch((err) =>
                    console.error('[BTal] resetDayMenu:', err),
                  );
              },
            },
          ]}
        />

        {/* Toast de confirmación post-reset · entra y sale en 2s. */}
        <IonToast
          isOpen={resetToastOpen}
          onDidDismiss={() => setResetToastOpen(false)}
          message="Día reseteado"
          duration={2000}
          position="bottom"
          color="success"
        />

        {/* Editor de mini-card · hora + título override + quitar del día.
            Lo abre el onClick de las mini-cards · separa el flujo "edito
            esta card de este día" (común) del "edito la receta global"
            (menos común, accesible desde la toolbar). */}
        {editingSup && (
          <SupCardEditor
            isOpen={editingSup !== null}
            onClose={() => setEditingSup(null)}
            day={selectedDay}
            kind={editingSup}
          />
        )}

        {/* Duplicar comida a varios días · Sub-fase 2B.4. Calculamos
            daysWithData en el sitio donde tenemos el doc · evita pasar
            el doc completo al modal. */}
        {duplicatingMeal && comidasDelDia && userDoc?.menu && (
          <DuplicateMealModal
            isOpen={duplicatingMeal !== null}
            onClose={() => setDuplicatingMeal(null)}
            srcDay={selectedDay}
            meal={duplicatingMeal}
            daysWithData={Object.fromEntries(
              DAY_KEYS.map((d) => [
                d,
                userDoc.menu[d][duplicatingMeal].alimentos.length > 0,
              ]),
            ) as Record<DayKey, boolean>}
          />
        )}

        {/* Duplicar EXTRA · gemelo del modal de las fijas. Le pasamos
            el count por día para que las filas de días llenos (8/8)
            queden deshabilitadas con su chip "Lleno". */}
        {duplicatingExtra && userDoc?.menu && (
          <DuplicateMealExtraModal
            isOpen={duplicatingExtra !== null}
            onClose={() => setDuplicatingExtra(null)}
            srcDay={selectedDay}
            extra={duplicatingExtra}
            extrasCountByDay={Object.fromEntries(
              DAY_KEYS.map((d) => [d, userDoc.menu[d].extras.length]),
            ) as Record<DayKey, number>}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default MenuPage;

// ─── Sub-componentes locales ───────────────────────────────────────────────

// Card "TOTAL [DÍA]" · vive al final del menú, justo antes de la
// media semanal. 4 pills con macros del día sumando comidas + extras
// + batido + creatina (la creatina suelta no aporta macros pero el
// batido sí). Cada número re-monta con `key={value}` para reanimar
// con `btal-anim-bump` al cambiar. Réplica del v1 `.day-total` con
// `.day-total-label` ("TOTAL LUNES") + `.day-total-macros` (4 pills).
//
// Botón ⋯ a la derecha · abre IonPopover con 3 opciones (igual que el
// v1 .day-menu-popup):
//   - Excluir/Incluir en media semanal
//   - Ocultar/Mostrar día
//   - Resetear día (con IonAlert de confirmación)
interface DayTotalCardProps {
  day: DayKey;
  totales: TotalesDia;
  isExcluded: boolean;
  isHidden: boolean;
  onToggleExcluded: () => void;
  onToggleHidden: () => void;
  onReset: () => void;
}
function DayTotalCard({
  day,
  totales,
  isExcluded,
  isHidden,
  onToggleExcluded,
  onToggleHidden,
  onReset,
}: DayTotalCardProps) {
  const [popoverEvent, setPopoverEvent] = useState<MouseEvent | undefined>(
    undefined,
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  const closePopover = () => {
    setPopoverOpen(false);
    setPopoverEvent(undefined);
  };

  return (
    <div
      className={
        'menu-day-total'
        + (isExcluded ? ' menu-day-total--excluded' : '')
        + (isHidden ? ' menu-day-total--hidden' : '')
      }
    >
      <div className="menu-day-total-head">
        <div className="menu-day-total-head-info">
          <span className="menu-day-total-label">
            Total · {DAY_LABEL_FULL[day]}
          </span>
          <span className="menu-day-total-sub">
            {isHidden
              ? 'día oculto'
              : isExcluded
              ? 'no cuenta en la media'
              : totales.comidasConDatos === 0
              ? 'sin comidas'
              : totales.comidasConDatos === 1
              ? '1 comida'
              : `${totales.comidasConDatos} comidas`}
          </span>
        </div>
        <button
          type="button"
          className="menu-day-total-menu-btn"
          aria-label="Opciones del día"
          aria-haspopup="menu"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            setPopoverEvent(e.nativeEvent);
            setPopoverOpen(true);
          }}
        >
          <MealIcon value="tb:dots" size={20} />
        </button>
      </div>
      <div className="menu-day-total-macros">
        <span className="menu-day-total-macro menu-day-total-macro--kcal">
          <span
            key={`k-${totales.kcal}`}
            className="menu-day-total-macro-num btal-anim-bump"
          >
            {totales.kcal.toLocaleString('es-ES')}
          </span>
          <span className="menu-day-total-macro-unit">kcal</span>
        </span>
        <span className="menu-day-total-macro menu-day-total-macro--prot">
          <span
            key={`p-${totales.prot}`}
            className="menu-day-total-macro-num btal-anim-bump"
          >
            {totales.prot}
          </span>
          <span className="menu-day-total-macro-unit">g P</span>
        </span>
        <span className="menu-day-total-macro menu-day-total-macro--carb">
          <span
            key={`c-${totales.carb}`}
            className="menu-day-total-macro-num btal-anim-bump"
          >
            {totales.carb}
          </span>
          <span className="menu-day-total-macro-unit">g C</span>
        </span>
        <span className="menu-day-total-macro menu-day-total-macro--fat">
          <span
            key={`f-${totales.fat}`}
            className="menu-day-total-macro-num btal-anim-bump"
          >
            {totales.fat}
          </span>
          <span className="menu-day-total-macro-unit">g G</span>
        </span>
      </div>

      {/* Popover con las 3 opciones del día · réplica v1 .day-menu-popup. */}
      <IonPopover
        isOpen={popoverOpen}
        event={popoverEvent}
        onDidDismiss={closePopover}
        showBackdrop={false}
        dismissOnSelect
        className="menu-day-popover"
      >
        <IonContent className="menu-day-popover-content">
          <button
            type="button"
            className="menu-day-popover-item"
            onClick={() => {
              closePopover();
              onToggleExcluded();
            }}
          >
            <MealIcon value="tb:circle-minus" size={18} />
            <span>
              {isExcluded
                ? 'Incluir en media semanal'
                : 'Excluir de media semanal'}
            </span>
          </button>
          <button
            type="button"
            className="menu-day-popover-item"
            onClick={() => {
              closePopover();
              onToggleHidden();
            }}
          >
            <MealIcon value={isHidden ? 'tb:eye' : 'tb:eye-off'} size={18} />
            <span>{isHidden ? 'Mostrar día' : 'Ocultar día'}</span>
          </button>
          <button
            type="button"
            className="menu-day-popover-item menu-day-popover-item--warn"
            onClick={() => {
              closePopover();
              onReset();
            }}
          >
            <MealIcon value="tb:refresh" size={18} />
            <span>Resetear día</span>
          </button>
        </IonContent>
      </IonPopover>
    </div>
  );
}

// Card de media semanal · vive al final del menú · réplica EXACTA
// del v1 `.macro-overview` con 4 `.macro-item`. Cada stat tiene:
//   - número grande (Bebas Neue) en el color de su macro
//   - sufijo "kcal" / "g" inline, más pequeño y con opacidad
//   - label uppercase debajo ("Calorías · media semanal", etc.)
//
// Animación: cuando la card entra en viewport por primera vez (≥30%)
// los números cuentan de 0 al target con easeOutCubic 600ms (réplica
// del v1 `animateNumber` + IntersectionObserver). Si el target cambia
// después (al editar comidas), interpolan del valor actual al nuevo.
function WeeklyAverageCard({ avg }: { avg: MediaSemanal }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useFirstVisible(ref);
  // `enabled` solo deja arrancar el count-up cuando la card es
  // visible · antes muestra 0. Cuando pasa a visible, anima 0 → target.
  const kcal = useCountUp(avg.kcal, { enabled: visible });
  const prot = useCountUp(avg.prot, { enabled: visible });
  const carb = useCountUp(avg.carb, { enabled: visible });
  const fat = useCountUp(avg.fat, { enabled: visible });

  return (
    <div ref={ref} className="menu-week-avg">
      {/* Header tipo el de DayTotalCard · todo en una línea ·
          "MEDIA SEMANAL · Promedio de los 7 días". */}
      <div className="menu-week-avg-head">
        <span className="menu-week-avg-head-label">
          Media semanal
          <span className="menu-week-avg-head-sub">
            {' · Promedio de los 7 días'}
          </span>
        </span>
      </div>
      <div className="menu-week-avg-grid">
        <div className="menu-week-avg-stat">
          <div className="menu-week-avg-num menu-week-avg-num--kcal">
            <span className="menu-week-avg-num-value">
              {kcal.toLocaleString('es-ES')}
            </span>
            <span className="menu-week-avg-unit-inline">KCAL</span>
          </div>
          <div className="menu-week-avg-label">Calorías</div>
        </div>
        <div className="menu-week-avg-stat">
          <div className="menu-week-avg-num menu-week-avg-num--prot">
            <span className="menu-week-avg-num-value">{prot}</span>
            <span className="menu-week-avg-unit-inline">G</span>
          </div>
          <div className="menu-week-avg-label">Proteína</div>
        </div>
        <div className="menu-week-avg-stat">
          <div className="menu-week-avg-num menu-week-avg-num--carb">
            <span className="menu-week-avg-num-value">{carb}</span>
            <span className="menu-week-avg-unit-inline">G</span>
          </div>
          <div className="menu-week-avg-label">Carbohidratos</div>
        </div>
        <div className="menu-week-avg-stat">
          <div className="menu-week-avg-num menu-week-avg-num--fat">
            <span className="menu-week-avg-num-value">{fat}</span>
            <span className="menu-week-avg-unit-inline">G</span>
          </div>
          <div className="menu-week-avg-label">Grasas</div>
        </div>
      </div>
    </div>
  );
}

interface DaySummaryProps {
  day: DayKey;
  totales: TotalesDia;
  objetivoKcal: number | null;
}

// Card con ring SVG de progreso + totales del día. El % se calcula con
// el objetivo efectivo (manual o calculado). Si no hay objetivo, muestra
// solo el total absoluto sin ring.
function DaySummary({ day, totales, objetivoKcal }: DaySummaryProps) {
  // Progreso 0-100 · clampeado para que ringos > 100% no se desborden.
  // El ring es siempre visible aunque haya 0 comidas (queda vacío).
  const progress = objetivoKcal && objetivoKcal > 0
    ? Math.min(100, Math.round((totales.kcal / objetivoKcal) * 100))
    : 0;

  // SVG · radio 26, perímetro = 2π·26 ≈ 163.36. Stroke dasharray controla
  // cuánto del círculo se rellena. Animación CSS suaviza el cambio.
  const RADIUS = 26;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashArray = `${(progress / 100) * CIRC} ${CIRC}`;

  return (
    <div className="menu-day-summary">
      <div className="menu-day-ring">
        <svg width="64" height="64" aria-hidden="true">
          <circle
            className="menu-day-ring-bg"
            cx="32"
            cy="32"
            r={RADIUS}
          />
          <circle
            className="menu-day-ring-fg"
            cx="32"
            cy="32"
            r={RADIUS}
            strokeDasharray={dashArray}
            strokeDashoffset="0"
          />
        </svg>
        <div className="menu-day-ring-text">
          {objetivoKcal ? `${progress}%` : '—'}
        </div>
      </div>
      <div className="menu-day-summary-info">
        <div className="menu-day-summary-label">Progreso del día</div>
        <div className="menu-day-summary-value">
          {totales.kcal.toLocaleString('es-ES')} kcal
          {totales.prot > 0 && ` · ${totales.prot}g prot`}
        </div>
        <div className="menu-day-summary-sub">
          {objetivoKcal
            ? `${progress}% del objetivo (${objetivoKcal.toLocaleString('es-ES')} kcal)`
            : 'Define tu objetivo en Editar perfil'}
          {' · '}
          {totales.comidasConDatos === 0
            ? 'sin comidas todavía'
            : totales.comidasConDatos === 1
            ? '1 comida'
            : `${totales.comidasConDatos} comidas`}
        </div>
      </div>
      {/* Día seleccionado · pista textual para a11y · oculto visualmente */}
      <span className="menu-day-summary-day">{DAY_LABEL_FULL[day]}</span>
    </div>
  );
}

interface MealCardProps {
  meal: MealKey;
  comida: Comida;
  onClick: () => void;
}

function MealCard({ meal, comida, onClick }: MealCardProps) {
  const isEmpty = comida.alimentos.length === 0;
  const plato = (comida.nombrePlato ?? '').trim();
  return (
    <button
      type="button"
      className={'menu-meal' + (isEmpty ? ' menu-meal--empty' : '')}
      onClick={blurAndRun(onClick)}
      aria-label={`Abrir detalle de ${MEAL_LABEL[meal].toLowerCase()}`}
    >
      <div className="menu-meal-emoji" aria-hidden="true">
        <MealIcon
          value={comida.emoji}
          fallback={MEAL_ICON_DEFAULT[meal]}
          size={32}
        />
      </div>
      <div className="menu-meal-body">
        <div className="menu-meal-row">
          <div className="menu-meal-name">
            {MEAL_LABEL[meal]}
            {comida.source === 'user' && (
              <span className="menu-meal-source" title="Editado por ti" aria-hidden>
                <MealIcon value="tb:pencil" size={14} />
              </span>
            )}
            {comida.source === 'ai' && (
              <span className="menu-meal-source menu-meal-source--ai" title="Generado por IA" aria-hidden>
                <MealIcon value="tb:sparkles" size={14} />
              </span>
            )}
          </div>
          <div className="menu-meal-time">
            {comida.hora ?? '--:--'}
          </div>
        </div>
        {/* En la card del menú · nombre del plato + macros pills. La
            lista detallada de alimentos vive en el sheet (al pulsar). */}
        <div className="menu-meal-desc">
          {plato ? (
            plato
          ) : isEmpty ? (
            <em>Aún sin comida · pulsa para añadir</em>
          ) : (
            <em>Pulsa para añadir nombre del plato</em>
          )}
        </div>
        {!isEmpty && (
          <div className="menu-meal-macros">
            {comida.kcal > 0 && (
              <span className="menu-macro-pill menu-macro-pill--kcal">
                <MealIcon value="tb:flame" size={14} />
                {comida.kcal} kcal
              </span>
            )}
            {comida.prot > 0 && (
              <span className="menu-macro-pill menu-macro-pill--prot">
                <MealIcon value="tb:barbell" size={14} />
                {comida.prot}g P
              </span>
            )}
            {comida.carb > 0 && (
              <span className="menu-macro-pill menu-macro-pill--carb">
                <MealIcon value="tb:leaf" size={14} />
                {comida.carb}g C
              </span>
            )}
            {comida.fat > 0 && (
              <span className="menu-macro-pill menu-macro-pill--fat">
                <MealIcon value="tb:droplet" size={14} />
                {comida.fat}g G
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

interface SupCardProps {
  kind: 'batido' | 'creatina';
  title: string;
  hora: string; // siempre rellena (override → default)
  desc: string;
  // Macros opcionales · solo el batido los muestra (la creatina suelta no
  // aporta macros relevantes y queda más limpia sin pills).
  kcal?: number;
  prot?: number;
  carb?: number;
  fat?: number;
  // Si la card pertenece al día de HOY y el user lo marcó como tomado
  // desde HoyPage, marcamos visualmente con borde verde + tag "✓ TOMADO".
  // Réplica de la lógica `meal-card-batido-taken` / `meal-card-creatina-taken`
  // del v1 (`applyBatidoTakenVisual`).
  takenToday?: boolean;
  onClick: () => void;
}

// Mini-card de batido / creatina añadidos al día activo. Pulsar abre el
// modal info correspondiente (donde el user puede quitarla del día). Misma
// estructura visual que MealCard pero con clase de acento (gold/violeta) y
// tag flotante "✓ Tomado/a" en la esquina · refuerza la sensación de "lo
// añadiste a este día".
function SupCard({
  kind,
  title,
  hora,
  desc,
  kcal,
  prot,
  carb,
  fat,
  takenToday = false,
  onClick,
}: SupCardProps) {
  // El género del tag depende del suplemento: "TOMADO" (batido masc),
  // "TOMADA" (creatina fem) · igual que v1.
  const tagTomado = kind === 'batido' ? '✓ TOMADO' : '✓ TOMADA';
  return (
    <button
      type="button"
      className={
        'menu-meal menu-sup-card menu-sup-card--' + kind
        + (takenToday ? ' menu-sup-card--taken' : '')
      }
      onClick={blurAndRun(onClick)}
      aria-label={`Abrir detalle de ${title.toLowerCase()}`}
    >
      {takenToday && (
        <span className={'menu-sup-card-taken-tag menu-sup-card-taken-tag--' + kind}>
          {tagTomado}
        </span>
      )}
      <div className="menu-meal-emoji" aria-hidden="true">
        <MealIcon
          value={kind === 'batido' ? 'tb:cup' : 'tb:ladle'}
          size={32}
          className="menu-meal-emoji-icon"
        />
      </div>
      <div className="menu-meal-body">
        <div className="menu-meal-row">
          <div className="menu-meal-name">
            {title}
            <span className="menu-sup-tag" aria-hidden="true">✓ Añadido</span>
          </div>
          <div className="menu-meal-time">{hora}</div>
        </div>
        <div className="menu-meal-desc">{desc}</div>
        {kcal !== undefined && (
          <div className="menu-meal-macros">
            {kcal > 0 && (
              <span className="menu-macro-pill menu-macro-pill--kcal">
                <MealIcon value="tb:flame" size={14} />
                {kcal} kcal
              </span>
            )}
            {prot !== undefined && prot > 0 && (
              <span className="menu-macro-pill menu-macro-pill--prot">
                <MealIcon value="tb:barbell" size={14} />
                {prot}g P
              </span>
            )}
            {carb !== undefined && carb > 0 && (
              <span className="menu-macro-pill menu-macro-pill--carb">
                <MealIcon value="tb:leaf" size={14} />
                {carb}g C
              </span>
            )}
            {fat !== undefined && fat > 0 && (
              <span className="menu-macro-pill menu-macro-pill--fat">
                <MealIcon value="tb:droplet" size={14} />
                {fat}g G
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

interface ExtraMealCardProps {
  extra: ComidaExtra;
  onClick: () => void;
}

// Card de una comida extra (custom). Si `esExtra !== false` (default
// para retro-compat con docs antiguos) la card adopta el borde
// dashed lima + chip "EXTRA" junto al nombre. Si el user creó la
// comida desde el editor con el check "EXTRA" desmarcado, la card se
// renderiza como una comida normal (sin dashed, sin chip).
function ExtraMealCard({ extra, onClick }: ExtraMealCardProps) {
  const isEmpty = extra.alimentos.length === 0;
  const isExtra = extra.esExtra ?? true;
  const isDisabled = !!extra.deshabilitada;
  const plato = (extra.nombrePlato ?? '').trim();
  return (
    <button
      type="button"
      className={
        'menu-meal'
        + (isExtra ? ' menu-meal-extra' : '')
        + (isEmpty ? ' menu-meal--empty' : '')
        + (isDisabled ? ' menu-meal--disabled' : '')
      }
      onClick={blurAndRun(onClick)}
      aria-label={
        (isDisabled ? 'Comida deshabilitada · ' : '')
        + `Editar ${extra.nombre || 'comida'}`
      }
    >
      <div className="menu-meal-emoji" aria-hidden="true">
        <MealIcon
          value={extra.emoji}
          fallback={EXTRA_ICON_DEFAULT}
          size={32}
        />
      </div>
      <div className="menu-meal-body">
        <div className="menu-meal-row">
          <div className="menu-meal-name">
            {extra.nombre || (isExtra ? 'Comida extra' : 'Comida')}
            {isExtra && (
              <span className="menu-meal-extra-tag" aria-hidden="true">
                extra
              </span>
            )}
          </div>
          <div className="menu-meal-time">{extra.hora ?? '--:--'}</div>
        </div>
        {/* Igual que MealCard fija · nombre del plato + macros pills. */}
        <div className="menu-meal-desc">
          {plato ? (
            plato
          ) : isEmpty ? (
            <em>Pulsa para añadir alimentos</em>
          ) : (
            <em>Pulsa para añadir nombre del plato</em>
          )}
        </div>
        {!isEmpty && (
          <div className="menu-meal-macros">
            {extra.kcal > 0 && (
              <span className="menu-macro-pill menu-macro-pill--kcal">
                <MealIcon value="tb:flame" size={14} />
                {extra.kcal} kcal
              </span>
            )}
            {extra.prot > 0 && (
              <span className="menu-macro-pill menu-macro-pill--prot">
                <MealIcon value="tb:barbell" size={14} />
                {extra.prot}g P
              </span>
            )}
            {extra.carb > 0 && (
              <span className="menu-macro-pill menu-macro-pill--carb">
                <MealIcon value="tb:leaf" size={14} />
                {extra.carb}g C
              </span>
            )}
            {extra.fat > 0 && (
              <span className="menu-macro-pill menu-macro-pill--fat">
                <MealIcon value="tb:droplet" size={14} />
                {extra.fat}g G
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
