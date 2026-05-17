import {
  IonButton,
  IonContent,
  IonModal,
  IonSpinner,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { canGenerateAi } from '../utils/ia';
import { blurAndRun } from '../utils/focus';
import { formatHeight, formatWeight } from '../utils/units';
import { usePreferences } from '../hooks/usePreferences';
import {
  AI_SCOPE_OPTIONS,
  EQUIPAMIENTOS,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  RESTRICCIONES,
  alergiaLabel,
  intoleranciaLabel,
  type AiScopeChoice,
  type Entrenos,
  type RegistroStats,
  type UserProfile,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './AiPromptSummaryModal.css';

// Mismo mapping de scope → Ionicon que en AiGenerateModal · sustituye
// los emojis (✨ 🍽️ 📋 🏋️) por iconos coherentes con el resto de la UI.
const SCOPE_ICON: Record<AiScopeChoice, string> = {
  all: 'tb:sparkles',
  menu_compra: 'tb:tools-kitchen-2',
  menu_only: 'tb:list',
  entrenos_only: 'tb:barbell',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Scope que se va a generar (lo que el user eligió en el paso anterior).
  scope: AiScopeChoice;
  // Override del perfil — útil en el onboarding, donde el perfil aún no
  // está guardado. Si no se pasa, usa userDoc.profile del provider.
  profileOverride?: UserProfile;
  // Callback cuando el user confirma · ahora dispara la generación o,
  // en el onboarding, finaliza el flujo (saveOnboarding + redirect).
  onConfirm: () => void;
  // Callback cuando el user pulsa "Modificar". Si NO se pasa, no se
  // muestra el botón (caso edge poco probable).
  onModify?: () => void;
  // Texto del botón confirmar — varía por contexto:
  //   - Onboarding: "Confirmar y generar mi plan"
  //   - Botones IA en tabs: "Generar con IA"
  confirmLabel?: string;
  // Mientras el caller hace el async submit (ej. saveOnboarding), bloquea
  // el botón confirmar y muestra spinner.
  submitting?: boolean;
}

// Modal que muestra al usuario TODO lo que se enviará al modelo de IA
// antes de hacer la llamada. Usado en:
//   - Onboarding paso 5 (modo='ai') antes de Finalizar
//   - Cada botón Generar IA tras elegir scope (Hoy/Menú/Entreno)
//
// Botones:
//   - "Modificar"          → cierra modal y permite al user volver a editar
//   - "Confirmar y generar" → dispara onConfirm() (genera o finaliza)
//
// La regla de negocio (Free 1 gen/mes) la vuelve a aplicar canGenerateAi
// como segunda capa de seguridad — el user pudo haber agotado la cuota
// entre que abrió el flujo y llegó aquí.
export function AiPromptSummaryModal({
  isOpen,
  onClose,
  scope,
  profileOverride,
  onConfirm,
  onModify,
  confirmLabel = 'Confirmar y generar',
  submitting = false,
}: Props) {
  const { user } = useAuth();
  const { profile: userDoc } = useProfile();
  const { units } = usePreferences();
  const isAnonymous = user?.isAnonymous ?? false;

  // Profile a renderizar · prioriza override (onboarding) sobre profile
  // ya guardado (caller desde botón Generar IA).
  const profile = profileOverride ?? userDoc?.profile ?? null;
  // Plan de entreno actual y stats · solo del userDoc real (no aplica
  // al onboarding · ahí no hay plan ni stats todavía). La IA real
  // (Fase 6, Cloud Function `generatePlan`) lee el doc del user en
  // server-side · este bloque es informativo para que el user vea
  // qué contexto tiene la IA antes de generar.
  const entrenos: Entrenos | undefined = profileOverride ? undefined : userDoc?.entrenos;
  const registroStats: RegistroStats | undefined = profileOverride
    ? undefined
    : userDoc?.registroStats;

  // Elegibilidad — en el onboarding aún no hay generaciones consumidas
  // (consumidas_ciclo=0) Y `userDoc.profile.modo` sigue siendo el default
  // 'manual' porque el user todavía no ha llegado a guardar. Si llamáramos
  // a `canGenerateAi(userDoc, ...)` sin más, devolvería `allowed:false` por
  // `manual_mode` aunque el user acaba de elegir IA en el StepMode previo.
  // Detectamos onboarding por la presencia de `profileOverride` (única vía
  // de uso que pasa profile prefab no guardado) y forzamos allowed=true ·
  // la generación real se hace ya con el doc persistido en Fase 6.
  const isOnboarding = !!profileOverride;
  const eligibility = isOnboarding
    ? { allowed: true, reason: 'ok_free' as const }
    : canGenerateAi(userDoc, isAnonymous);
  const scopeOption = AI_SCOPE_OPTIONS.find((s) => s.value === scope);

  if (!profile) {
    // Edge case · nunca debería ocurrir en la práctica.
    return null;
  }

  // Helpers de presentación · todos devuelven string vacío para "no hay
  // dato" (los renderizamos con un dash discreto).
  const nivel = NIVELES_ACTIVIDAD.find((n) => n.value === profile.actividad);
  const equip = EQUIPAMIENTOS.find((e) => e.value === profile.equipamiento);
  const obj = OBJETIVOS.find((o) => o.value === profile.objetivo);
  const restriccionesLabels = profile.restricciones
    .map((r) => RESTRICCIONES.find((x) => x.value === r)?.label)
    .filter((x): x is string => Boolean(x));

  // Para alergias / intolerancias · separamos predefinidas (label legible)
  // y custom (texto libre tal cual).
  const renderAlergias = profile.alergias.map((a) => alergiaLabel(a));
  const renderIntolerancias = profile.intolerancias.map((i) => intoleranciaLabel(i));

  // Plan de entreno activo + custom predeterminado para el bloque "Plan
  // de entreno". Cuando hay custom predeterminado, la IA debería
  // RESPETARLO (no sobrescribirlo) salvo que el user lo desmarque o
  // active "permitir tocar lo mío". Se lo indicamos al user en el
  // resumen para que sepa lo que la IA va a recibir.
  const activePlan = entrenos?.planes[entrenos.activePlan] ?? null;
  const customPredeterminado = entrenos
    ? Object.values(entrenos.planes).find(
        (p) => p && !p.builtIn && p.esPredeterminado,
      ) ?? null
    : null;

  // Top 3 PRs · ordenados por kg desc · informativo para que el user
  // vea que la IA "conoce" sus récords al sugerir progresiones.
  const topPRs = registroStats
    ? Object.entries(registroStats.prs)
        .map(([exNorm, pr]) => ({ exercise: exNorm, kg: pr.kg }))
        .sort((a, b) => b.kg - a.kg)
        .slice(0, 3)
    : [];

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="settings-modal"
    >
      <IonContent>
        <div className="settings-modal-bg">
          <div className="settings-modal-card ai-summary-card">
            {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
            <button
              type="button"
              className="settings-modal-close settings-modal-close--fixed"
              onClick={blurAndRun(onClose)}
              aria-label="Cerrar"
            >
              <MealIcon value="tb:x" size={22} />
            </button>
            <div className="ai-summary-head">
              <div className="ai-summary-icon">
                <MealIcon value="tb:sparkles" size={28} />
              </div>
              <div>
                <h2 className="settings-modal-title">Confirma los datos que usará la IA para la generación</h2>
                <p className="settings-modal-text" style={{ margin: '6px 0 0' }}>
                  Revisa los datos. Si hay que cambiar algo pulsa Modificar;
                  si está bien, generamos.
                </p>
              </div>
            </div>

            {/* Scope destacado arriba · el user ve qué exactamente va a generar */}
            {scopeOption && (
              <div className="ai-summary-scope-banner">
                <span className="ai-summary-scope-emoji" aria-hidden>
                  <MealIcon value={SCOPE_ICON[scopeOption.value]} size={20} />
                </span>
                <div>
                  <div className="ai-summary-scope-title">{scopeOption.label}</div>
                  <div className="ai-summary-scope-sub">{scopeOption.sub}</div>
                </div>
              </div>
            )}

            {/* Eligibility hint (límite Free agotado, Pro activo, etc.) */}
            {eligibility.hint && (
              <div
                className={
                  'ai-summary-hint'
                  + (eligibility.allowed ? ' ai-summary-hint--ok' : ' ai-summary-hint--blocked')
                }
              >
                {eligibility.hint}
              </div>
            )}

            {/* ── Datos personales ── */}
            <SummaryBlock title="Datos personales">
              <SummaryRow label="Nombre" value={profile.nombre || '—'} />
              <SummaryRow label="Edad" value={profile.edad !== null ? `${profile.edad} años` : '—'} />
              <SummaryRow label="Sexo" value={profile.sexo === 'm' ? 'Hombre' : profile.sexo === 'f' ? 'Mujer' : '—'} />
              <SummaryRow label="Peso" value={formatWeight(profile.peso, units)} />
              <SummaryRow label="Altura" value={formatHeight(profile.altura, units)} />
            </SummaryBlock>

            {/* ── Estilo de vida ── */}
            <SummaryBlock title="Estilo de vida">
              <SummaryRow label="Actividad" value={nivel?.label ?? '—'} />
              <SummaryRow
                label="Días entreno"
                value={profile.diasEntreno !== null ? `${profile.diasEntreno} / semana` : '—'}
              />
              <SummaryRow label="Equipamiento" value={equip?.label ?? '—'} />
            </SummaryBlock>

            {/* ── Objetivo + restricciones genéricas ── */}
            <SummaryBlock title="Objetivo">
              <SummaryRow label="Quiero" value={obj?.label ?? '—'} highlight />
              <SummaryRow
                label="Kcal/día objetivo"
                value={
                  profile.objetivoKcal !== null
                    ? `${profile.objetivoKcal} kcal`
                    : 'Calculado automáticamente'
                }
              />
              <SummaryChips
                label="Restricciones"
                items={restriccionesLabels}
                color="lime"
                empty="Ninguna"
              />
            </SummaryBlock>

            {/* ── Plan de entreno actual ──
                Solo se renderiza fuera del onboarding (cuando ya hay
                userDoc real). Si hay un custom predeterminado, lo
                destacamos · la IA debe respetarlo al regenerar.
                Ayuda al user a entender qué contexto recibe la IA. */}
            {activePlan && (
              <SummaryBlock title="Plan de entreno actual">
                <SummaryRow
                  label="Plan activo"
                  value={activePlan.nombre}
                  highlight
                />
                <SummaryRow
                  label="Días del plan"
                  value={`${activePlan.dias.length} ${activePlan.dias.length === 1 ? 'día' : 'días'}`}
                />
                {customPredeterminado && (
                  <SummaryRow
                    label="Predeterminado"
                    value={`${customPredeterminado.nombre} (la IA respetará este plan)`}
                  />
                )}
              </SummaryBlock>
            )}

            {/* ── Récords personales ──
                Solo si hay alguno. Top 3 por kg desc · informativo
                para que el user vea que la IA "conoce" sus PRs. La
                IA real (Fase 6) usará estos datos para sugerir
                progresiones realistas (ej. no proponer cargas por
                debajo del PR ya alcanzado). */}
            {topPRs.length > 0 && (
              <SummaryBlock title="Tus récords actuales">
                {topPRs.map((pr) => (
                  <SummaryRow
                    key={pr.exercise}
                    label={pr.exercise.charAt(0).toUpperCase() + pr.exercise.slice(1)}
                    value={`${pr.kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`}
                  />
                ))}
              </SummaryBlock>
            )}

            {/* ── Personalización IA · solo si hay algo ──
                Condición wrap en boolean: `array.length` con `&&` JSX
                cuando el length es 0 hace que React renderice el literal "0"
                (porque `0 && X` → `0`). Cualquier `.length` aquí necesita
                comparación explícita > 0. */}
            {(profile.notas.trim() !== ''
              || profile.alergias.length > 0
              || profile.intolerancias.length > 0
              || profile.alimentosProhibidos.length > 0
              || profile.alimentosObligatorios.length > 0
              || profile.ingredientesFavoritos.length > 0) && (
              <SummaryBlock title="Datos extra para la IA">
                {profile.notas.trim() && (
                  <SummaryNote label="Notas" text={profile.notas.trim()} />
                )}
                {profile.alergias.length > 0 && (
                  <SummaryChips
                    label="Alergias"
                    items={renderAlergias}
                    color="coral"
                  />
                )}
                {profile.intolerancias.length > 0 && (
                  <SummaryChips
                    label="Intolerancias"
                    items={renderIntolerancias}
                    color="gold"
                  />
                )}
                {profile.alimentosProhibidos.length > 0 && (
                  <SummaryChips
                    label="Alimentos prohibidos"
                    items={profile.alimentosProhibidos}
                    color="coral"
                  />
                )}
                {profile.alimentosObligatorios.length > 0 && (
                  <SummaryChips
                    label="Alimentos obligatorios"
                    items={profile.alimentosObligatorios}
                    color="cyan"
                  />
                )}
                {profile.ingredientesFavoritos.length > 0 && (
                  <SummaryChips
                    label="Ingredientes favoritos"
                    items={profile.ingredientesFavoritos}
                    color="lime"
                  />
                )}
              </SummaryBlock>
            )}

            {/* Botones */}
            <div className="ai-summary-actions">
              {onModify && (
                <IonButton
                  type="button"
                  fill="outline"
                  className="ai-summary-modify"
                  onClick={blurAndRun(onModify)}
                  disabled={submitting}
                >
                  <MealIcon value="tb:edit" size={18} slot="start" />
                  Modificar
                </IonButton>
              )}
              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary ai-summary-confirm"
                onClick={blurAndRun(onConfirm)}
                disabled={!eligibility.allowed || submitting}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <MealIcon value="tb:sparkles" size={18} />
                    <span style={{ marginLeft: 8 }}>{confirmLabel}</span>
                  </>
                )}
              </IonButton>
            </div>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}

// ─── Sub-componentes locales ───────────────────────────────────────────────

interface BlockProps {
  title: string;
  children: React.ReactNode;
}

function SummaryBlock({ title, children }: BlockProps) {
  return (
    <div className="ai-summary-block">
      <h3 className="ai-summary-block-title">{title}</h3>
      <div className="ai-summary-block-body">{children}</div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function SummaryRow({ label, value, highlight }: RowProps) {
  return (
    <div className="ai-summary-row">
      <span className="ai-summary-row-label">{label}</span>
      <span
        className={'ai-summary-row-value' + (highlight ? ' ai-summary-row-value--lime' : '')}
      >
        {value}
      </span>
    </div>
  );
}

interface ChipsProps {
  label: string;
  items: string[];
  color: 'lime' | 'cyan' | 'coral' | 'gold' | 'violet';
  // Texto a mostrar si la lista está vacía. Si no se pasa, no se renderiza.
  empty?: string;
}

function SummaryChips({ label, items, color, empty }: ChipsProps) {
  if (items.length === 0 && !empty) return null;
  return (
    <div className="ai-summary-chips">
      <span className="ai-summary-chips-label">{label}</span>
      {items.length > 0 ? (
        <div className="ai-summary-chips-list">
          {items.map((it, i) => (
            <span key={`${it}-${i}`} className={'ai-summary-chip ai-summary-chip--' + color}>
              {it}
            </span>
          ))}
        </div>
      ) : (
        <span className="ai-summary-chips-empty">{empty}</span>
      )}
    </div>
  );
}

interface NoteProps {
  label: string;
  text: string;
}

function SummaryNote({ label, text }: NoteProps) {
  return (
    <div className="ai-summary-note">
      <span className="ai-summary-chips-label">{label}</span>
      <p className="ai-summary-note-text">{text}</p>
    </div>
  );
}
