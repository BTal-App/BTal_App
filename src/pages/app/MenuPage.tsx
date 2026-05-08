import { useEffect, useMemo, useRef, useState } from 'react';
import { IonAlert, IonContent, IonIcon, IonPage, IonToast } from '@ionic/react';
import {
  addOutline,
  barbellOutline,
  cafeOutline,
  flameOutline,
  leafOutline,
  sparklesOutline,
  waterOutline,
} from 'ionicons/icons';
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
import { blurAndRun } from '../../utils/focus';
import { todayDateStr, todayKey } from '../../utils/dateKeys';
import { objetivoKcalEfectivo } from '../../utils/calorias';
import {
  DAY_KEYS,
  HORA_DEFECTO,
  MAX_EXTRAS_POR_DIA,
  MEAL_KEYS,
  SUP_HORA_DEFECTO,
  SUP_TITULO_DEFECTO,
  type Comida,
  type ComidaExtra,
  type DayKey,
  type MealKey,
} from '../../templates/defaultUser';
import './MenuPage.css';

// Etiquetas humanas · centralizadas para no duplicar en cada componente.
const DAY_LABEL: Record<DayKey, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
};

// Día completo (para headers grandes y ARIA).
const DAY_LABEL_FULL: Record<DayKey, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

// Mapping de cada comida a su emoji + nombre legible. El emoji se queda
// hardcoded · no es preferencia del user, es identidad visual.
const MEAL_EMOJI: Record<MealKey, string> = {
  desayuno: '🌅',
  comida: '☀️',
  merienda: '🍎',
  cena: '🌙',
};

const MEAL_LABEL: Record<MealKey, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

// Suma kcal/prot/carb/fat de las 4 comidas del día.
interface TotalesDia {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  comidasConDatos: number;
}
function calcTotales(
  comidas: import('../../templates/defaultUser').ComidasDelDia,
): TotalesDia {
  let kcal = 0, prot = 0, carb = 0, fat = 0, comidasConDatos = 0;
  for (const meal of MEAL_KEYS) {
    const c = comidas[meal];
    if (!c) continue;
    kcal += c.kcal;
    prot += c.prot;
    carb += c.carb;
    fat += c.fat;
    if (c.alimentos.length > 0) comidasConDatos += 1;
  }
  // Sumamos también los extras del día · cuentan al ring de progreso.
  for (const extra of comidas.extras) {
    kcal += extra.kcal;
    prot += extra.prot;
    carb += extra.carb;
    fat += extra.fat;
    if (extra.alimentos.length > 0) comidasConDatos += 1;
  }
  return { kcal, prot, carb, fat, comidasConDatos };
}

// Convierte "HH:mm" en minutos del día · usado para el sort por hora.
// Si el string es inválido devuelve un valor alto · ese item cae al final.
function horaAMinutos(hora: string | null | undefined): number {
  if (!hora) return 24 * 60;
  const [h, m] = hora.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 24 * 60;
  return h * 60 + m;
}

// Filas ordenadas por hora (4 comidas fijas + extras + posibles mini-cards
// de batido y creatina). Solo lee data del doc · los callbacks (abrir
// modal) se resuelven en el JSX donde tenemos acceso al state local.
type OrderedRow =
  | { kind: 'meal'; meal: MealKey; comida: Comida; sortMinutes: number }
  | { kind: 'extra'; extra: ComidaExtra; sortMinutes: number }
  | {
      kind: 'batido' | 'creatina';
      title: string;
      emoji: string;
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
      emoji: '🥤',
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
      emoji: '🥄',
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
  // MealSheet · null = cerrado · MealKey = abierta para esa comida del
  // día seleccionado. Cerrar = setear a null (ya hay onDidDismiss).
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);
  // MealEditorModal · null = cerrado · MealKey = editando esa comida.
  // Cuando el user pulsa "Editar" en el sheet, cerramos el sheet y
  // abrimos este editor (no se solapan modales).
  const [editingMeal, setEditingMeal] = useState<MealKey | null>(null);
  // DuplicateMealModal · null = cerrado · MealKey = duplicando esa comida
  // del día seleccionado. Se abre desde MealSheet (botón "Duplicar").
  const [duplicatingMeal, setDuplicatingMeal] = useState<MealKey | null>(null);
  // Modales de suplementación · Sub-fase 2B.5.a.
  // - batidoOpen / creatinaOpen abren el modal info global (toolbar) ·
  //   contiene receta + macros + contadores inline.
  // - editingSup abre el editor de mini-card per-día (al pulsar la card).
  const [batidoOpen, setBatidoOpen] = useState(false);
  const [creatinaOpen, setCreatinaOpen] = useState(false);
  const [editingSup, setEditingSup] = useState<'batido' | 'creatina' | null>(
    null,
  );
  const { clearMeal, restoreMeal, removeMealExtra, restoreMealExtra } =
    useProfile();
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
  const totales = useMemo<TotalesDia | null>(
    () => (comidasDelDia ? calcTotales(comidasDelDia) : null),
    [comidasDelDia],
  );

  const objetivoKcal = useMemo(
    () => objetivoKcalEfectivo(userDoc?.profile),
    [userDoc?.profile],
  );

  return (
    <IonPage className="app-tab-page">
      <IonContent fullscreen>
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
                      <IonIcon icon={sparklesOutline} />
                      <span>Generar con IA</span>
                    </button>
                  </>
                )}
                <AppAvatarButton />
              </>
            }
          />

          {/* ── Day segment scrollable ── */}
          <div className="menu-day-segment" role="tablist" aria-label="Días de la semana">
            {DAY_KEYS.map((day) => {
              const active = selectedDay === day;
              const isToday = day === today;
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={DAY_LABEL_FULL[day]}
                  className={
                    'menu-day-chip'
                    + (active ? ' active' : '')
                    + (isToday ? ' today' : '')
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
              <IonIcon icon={addOutline} />
              <span>Añadir comida</span>
            </button>
          </div>

          {/* Toolbar de suplementos · Sub-fase 2B.5.a · 🥤 Batido + 🥄
              Creatina. Cuando el día activo los tiene añadidos, el botón
              cambia a verde y muestra ✓ inline al final del texto. */}
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
                <span>
                  🥤 Batido
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
                <span>
                  🥄 Creatina
                  {userDoc.suplementos.daysWithCreatina.includes(selectedDay)
                    ? ' ✓'
                    : ''}
                </span>
              </button>
            </div>
          )}

          {comidasDelDia ? (
            <div className="menu-meal-list">
              {/* Lista unificada de filas ordenadas por hora · combinamos
                  las 4 comidas del día y, si están añadidos, las mini-cards
                  de batido y creatina. La hora la lee del override → de la
                  comida → del default · garantiza orden estable. */}
              {buildOrderedRows(selectedDay, userDoc).map((row) => {
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
                      onClick={() =>
                        setExtraModal({ mode: 'edit', extra: row.extra })
                      }
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
                    emoji={row.emoji}
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
                <IonIcon icon={cafeOutline} />
              </div>
              <div className="hoy-empty-info">
                <span className="hoy-empty-title">Cargando menú…</span>
                <span className="hoy-empty-sub">
                  Estamos sincronizando tus comidas con la base de datos.
                </span>
              </div>
            </div>
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
            abierta. onEdit cierra el sheet y abre el MealEditorModal.
            onDuplicate sigue siendo placeholder hasta Sub-fase 2B.4. */}
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
      </IonContent>
    </IonPage>
  );
};

export default MenuPage;

// ─── Sub-componentes locales ───────────────────────────────────────────────

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
        <div className="menu-day-summary-label">Total del día</div>
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
        {comida.emoji ?? MEAL_EMOJI[meal]}
      </div>
      <div className="menu-meal-body">
        <div className="menu-meal-row">
          <div className="menu-meal-name">
            {MEAL_LABEL[meal]}
            {comida.source === 'user' && (
              <span className="menu-meal-source" title="Editado por ti">
                ✎
              </span>
            )}
            {comida.source === 'ai' && (
              <span className="menu-meal-source menu-meal-source--ai" title="Generado por IA">
                ✨
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
                <IonIcon icon={flameOutline} />
                {comida.kcal} kcal
              </span>
            )}
            {comida.prot > 0 && (
              <span className="menu-macro-pill menu-macro-pill--prot">
                <IonIcon icon={barbellOutline} />
                {comida.prot}g P
              </span>
            )}
            {comida.carb > 0 && (
              <span className="menu-macro-pill menu-macro-pill--carb">
                <IonIcon icon={leafOutline} />
                {comida.carb}g C
              </span>
            )}
            {comida.fat > 0 && (
              <span className="menu-macro-pill menu-macro-pill--fat">
                <IonIcon icon={waterOutline} />
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
  emoji: string;
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
  emoji,
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
        {emoji}
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
                <IonIcon icon={flameOutline} />
                {kcal} kcal
              </span>
            )}
            {prot !== undefined && prot > 0 && (
              <span className="menu-macro-pill menu-macro-pill--prot">
                <IonIcon icon={barbellOutline} />
                {prot}g P
              </span>
            )}
            {carb !== undefined && carb > 0 && (
              <span className="menu-macro-pill menu-macro-pill--carb">
                <IonIcon icon={leafOutline} />
                {carb}g C
              </span>
            )}
            {fat !== undefined && fat > 0 && (
              <span className="menu-macro-pill menu-macro-pill--fat">
                <IonIcon icon={waterOutline} />
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

// Card de una comida extra (custom). Mismo aspecto visual que MealCard
// pero con borde sutil distinto (acento lima dashed) para que se distinga
// como "tu comida" frente a las 4 fijas. Pulsar abre el editor.
function ExtraMealCard({ extra, onClick }: ExtraMealCardProps) {
  const isEmpty = extra.alimentos.length === 0;
  const plato = (extra.nombrePlato ?? '').trim();
  return (
    <button
      type="button"
      className={
        'menu-meal menu-meal-extra' + (isEmpty ? ' menu-meal--empty' : '')
      }
      onClick={blurAndRun(onClick)}
      aria-label={`Editar ${extra.nombre || 'comida extra'}`}
    >
      <div className="menu-meal-emoji" aria-hidden="true">
        {extra.emoji ?? '🍽'}
      </div>
      <div className="menu-meal-body">
        <div className="menu-meal-row">
          <div className="menu-meal-name">
            {extra.nombre || 'Comida extra'}
            <span className="menu-meal-extra-tag" aria-hidden="true">
              extra
            </span>
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
                <IonIcon icon={flameOutline} />
                {extra.kcal} kcal
              </span>
            )}
            {extra.prot > 0 && (
              <span className="menu-macro-pill menu-macro-pill--prot">
                <IonIcon icon={barbellOutline} />
                {extra.prot}g P
              </span>
            )}
            {extra.carb > 0 && (
              <span className="menu-macro-pill menu-macro-pill--carb">
                <IonIcon icon={leafOutline} />
                {extra.carb}g C
              </span>
            )}
            {extra.fat > 0 && (
              <span className="menu-macro-pill menu-macro-pill--fat">
                <IonIcon icon={waterOutline} />
                {extra.fat}g G
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
