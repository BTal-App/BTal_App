import { useEffect, useMemo, useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { TabHeader } from '../../components/TabHeader';
import { GuestBanner } from '../../components/GuestBanner';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { RegistroCalendar } from '../../components/registro/RegistroCalendar';
import { RegDayPanel } from '../../components/registro/RegDayPanel';
import { RegistroStatsGrid } from '../../components/registro/RegistroStatsGrid';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { usePreferences } from '../../hooks/usePreferences';
import { useRegistroMes } from '../../hooks/useRegistroMes';
import { useRegistroStats } from '../../hooks/useRegistroStats';
import {
  deleteRegistroDia as deleteRegistroDiaDb,
  setRegistroDia as setRegistroDiaDb,
} from '../../services/db';
import { getEffectiveRecommendedPlanId, type RegistroDia } from '../../templates/defaultUser';
import { todayDateStr } from '../../utils/dateKeys';
import { useScrollTopOnEnter } from '../../utils/useScrollTopOnEnter';
import { SaveStatusToast } from '../../components/SaveStatusToast';
import { DeleteStatusToast } from '../../components/DeleteStatusToast';
import { useSaveStatus, SAVE_FAILED } from '../../hooks/useSaveStatus';
import './RegistroPage.css';

// Tab Registro · Sub-fase 2E.
//
// Réplica funcional del REGISTRO DE PESOS del v1 (sección
// `progresion` del index.html monolítico) sobre Firestore (subcolección
// `/users/{uid}/registros/{YYYY-MM-DD}`). Compone:
//   - StatsGrid: 4 cards (racha, este mes, PRs, total)
//   - Calendar: grid mensual / semanal con dots de estado
//   - DayPanel inline (cuando hay día seleccionado): selector de plan,
//     ejercicios con kg/serie, sparkline de historial, notas y CRUD
//
// La posición del calendar (year + month0 + view) se persiste en
// `preferences.registroCal` para que sobreviva a recargas y cambios
// de dispositivo. La fecha seleccionada NO se persiste · entrar a la
// tab arranca sin selección y muestra solo stats + calendar.

const RegistroPage: React.FC = () => {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const { weekStart, registroCal, setRegistroCal } = usePreferences();

  const contentRef = useRef<HTMLIonContentElement>(null);
  useScrollTopOnEnter(contentRef);

  // Posición efectiva del calendar · si la pref está vacía, arrancamos
  // en mes/año actual y vista 'month'. Construir la fallback con
  // `useMemo` evita que cada render pinte un objeto nuevo (que
  // dispararía useEffect de useRegistroMes en cascada).
  const fallbackPos = useMemo(() => {
    const dt = new Date();
    return { year: dt.getFullYear(), month0: dt.getMonth(), view: 'month' as const };
  }, []);
  const pos = registroCal ?? fallbackPos;

  // Día seleccionado · null = nada abierto debajo del calendar.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Feedback separado para save vs delete · cada uno con su label propia
  // ("Guardando…/Guardado" vs "Eliminando…/Eliminado correctamente"). Solo
  // uno corre a la vez (UI no permite encadenarlos).
  const saveRegistro = useSaveStatus();
  const deleteRegistro = useSaveStatus();

  // Datos
  const { byDate } = useRegistroMes(pos.year, pos.month0);
  const stats = useRegistroStats();

  // Plan recomendado · si el user ha marcado algún plan custom como
  // predeterminado, la ★ del selector va en ÉSE. Si no, fallback al
  // builtIn derivado de `profile.diasEntreno`. Misma lógica que
  // EntrenoPage para que ambas tabs coincidan visualmente.
  const recommendedPlanId = userDoc
    ? getEffectiveRecommendedPlanId(
        userDoc.entrenos,
        userDoc.profile?.diasEntreno ?? null,
      )
    : null;

  // Stats "Este mes" · entrenamientos efectivos (plan != 'rest') hasta
  // hoy si estamos viendo el mes actual, o hasta fin de mes si es uno
  // pasado/futuro. Y = días pasados del mes (referencia humana).
  const today = todayDateStr();
  const { esteMesEntrenados, esteMesTotalDias } = useMemo(() => {
    const now = new Date();
    const isCurrent = pos.year === now.getFullYear() && pos.month0 === now.getMonth();
    const daysInMonth = new Date(pos.year, pos.month0 + 1, 0).getDate();
    const daysToCount = isCurrent ? now.getDate() : daysInMonth;
    let trained = 0;
    for (const fecha of Object.keys(byDate)) {
      const day = parseInt(fecha.slice(8, 10), 10);
      if (!Number.isFinite(day) || day > daysToCount) continue;
      const reg = byDate[fecha];
      if (reg && reg.plan && reg.plan !== 'rest') trained++;
    }
    return { esteMesEntrenados: trained, esteMesTotalDias: daysToCount };
  }, [byDate, pos.year, pos.month0]);

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleChangePos(next: { year: number; month0: number; view: 'month' | 'week' }) {
    setRegistroCal(next);
  }

  function handleSelectDate(fecha: string) {
    setSelectedDate(fecha);
    // Auto-scroll al panel del día tras la transición de Ionic. Lo
    // aplazamos un tick para que el panel ya esté en el DOM.
    requestAnimationFrame(() => {
      const el = document.getElementById('reg-day-panel-anchor');
      if (el && contentRef.current) {
        contentRef.current.scrollToPoint(0, el.offsetTop - 16, 300);
      }
    });
  }

  function handleClosePanel() {
    setSelectedDate(null);
  }

  async function handleSave(next: RegistroDia) {
    if (!user || !selectedDate) return;
    const result = await saveRegistro.runSave(() =>
      setRegistroDiaDb(user.uid, selectedDate, next),
    );
    if (result === SAVE_FAILED) return;
    // Refrescamos los recientes para que la racha se recalcule
    // inmediatamente (sin esperar a re-mount).
    void stats.refresh();
  }

  async function handleDelete() {
    if (!user || !selectedDate) return;
    const result = await deleteRegistro.runSave(() =>
      deleteRegistroDiaDb(user.uid, selectedDate),
    );
    if (result === SAVE_FAILED) return;
    void stats.refresh();
    setSelectedDate(null);
  }

  // Si user navegó a otro mes y la fecha seleccionada cae fuera del
  // rango visible, limpiamos la selección · evita inconsistencia entre
  // el panel (mostrando un día que ya no aparece en el grid) y el
  // calendar.
  useEffect(() => {
    if (!selectedDate) return;
    const [y, m] = selectedDate.split('-').map(Number);
    if (y !== pos.year || m - 1 !== pos.month0) {
      // No limpiamos en vista 'week' porque el anchor del panel ES la
      // fecha seleccionada · si cambia de mes la semana también.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (pos.view === 'month') setSelectedDate(null);
    }
  }, [pos.year, pos.month0, pos.view, selectedDate]);

  return (
    <IonPage className="app-tab-page">
      <IonContent ref={contentRef} fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Registro de "
            accent="pesos"
            right={<AppAvatarButton />}
          />

          <GuestBanner />

          <RegistroStatsGrid
            rachaActual={stats.racha.actual}
            rachaUltimaFecha={stats.racha.ultimaFecha}
            esteMesEntrenados={esteMesEntrenados}
            esteMesTotalDias={esteMesTotalDias}
            prsTotal={stats.prsTotal}
            totalEntrenos={stats.totalEntrenos}
          />

          <RegistroCalendar
            byDate={byDate}
            year={pos.year}
            month0={pos.month0}
            view={pos.view}
            selectedDate={selectedDate ?? today}
            weekStart={weekStart}
            onChangePos={handleChangePos}
            onSelectDate={handleSelectDate}
          />

          {selectedDate && (
            <div id="reg-day-panel-anchor">
              <RegDayPanel
                fecha={selectedDate}
                registro={byDate[selectedDate] ?? null}
                entrenos={userDoc?.entrenos}
                recommendedPlanId={recommendedPlanId}
                exerciseHistory={stats.exerciseHistory}
                prs={stats.prs}
                onSave={handleSave}
                onDelete={handleDelete}
                onClose={handleClosePanel}
              />
            </div>
          )}

          <div className="app-tab-pad-bottom" />
        </div>
      </IonContent>

      <SaveStatusToast status={saveRegistro.status} />
      <DeleteStatusToast status={deleteRegistro.status} />
    </IonPage>
  );
};

export default RegistroPage;
