import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
} from '@ionic/react';
import {
  closeOutline,
  createOutline,
  sparklesOutline,
} from 'ionicons/icons';
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
  type UserProfile,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './AiPromptSummaryModal.css';

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

  // Elegibilidad — en el onboarding aún no hay generaciones consumidas
  // (consumidas_ciclo=0), así que siempre allowed=true. En botones IA
  // ya generados, esto puede bloquear.
  const eligibility = canGenerateAi(userDoc, isAnonymous);
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

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="settings-modal"
    >
      {/* Cerrar fuera del IonContent · siempre visible aunque el resumen
          sea muy largo (perfil completo + scope + chips de personalización). */}
      <button
        type="button"
        className="settings-modal-close settings-modal-close--fixed"
        onClick={blurAndRun(onClose)}
        aria-label="Cerrar"
      >
        <IonIcon icon={closeOutline} />
      </button>
      <IonContent>
        <div className="settings-modal-bg">
          <div className="settings-modal-card ai-summary-card">
            <div className="ai-summary-head">
              <div className="ai-summary-icon">
                <IonIcon icon={sparklesOutline} />
              </div>
              <div>
                <h2 className="settings-modal-title">Confirma lo que enviaremos a la IA</h2>
                <p className="settings-modal-text" style={{ margin: '6px 0 0' }}>
                  Revisa los datos. Si hay que cambiar algo pulsa Modificar;
                  si está bien, generamos.
                </p>
              </div>
            </div>

            {/* Scope destacado arriba · el user ve qué exactamente va a generar */}
            {scopeOption && (
              <div className="ai-summary-scope-banner">
                <span className="ai-summary-scope-emoji">{scopeOption.emoji}</span>
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
              <SummaryChips
                label="Restricciones"
                items={restriccionesLabels}
                color="lime"
                empty="Ninguna"
              />
            </SummaryBlock>

            {/* ── Personalización IA · solo si hay algo ── */}
            {(profile.notas.trim()
              || profile.alergias.length
              || profile.intolerancias.length
              || profile.alimentosProhibidos.length
              || profile.alimentosObligatorios.length
              || profile.ingredientesFavoritos.length) && (
              <SummaryBlock title="Personalización para la IA">
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
                  <IonIcon icon={createOutline} slot="start" />
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
                    <IonIcon icon={sparklesOutline} slot="start" />
                    {confirmLabel}
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
