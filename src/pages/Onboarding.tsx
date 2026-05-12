import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import { MealIcon } from '../components/MealIcon';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { signOut } from '../services/auth';
import { AiPromptSummaryModal } from '../components/AiPromptSummaryModal';
import { ChipsInput } from '../components/ChipsInput';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { GeneratingScreen } from '../components/GeneratingScreen';
import { StepMode, type StepModeValue } from '../components/StepMode';
import {
  ALERGIAS_COMUNES,
  EQUIPAMIENTOS,
  INTOLERANCIAS_COMUNES,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  RESTRICCIONES,
  defaultProfile,
  type Equipamiento,
  type NivelActividad,
  type Objetivo,
  type Restriccion,
  type Sexo,
  type UserProfile,
} from '../templates/defaultUser';
import './Onboarding.css';

// Helper: alterna un valor en un array de strings (selección múltiple).
function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// Si el usuario ya completó onboarding nos largamos directo a /app.
// Esta página solo tiene sentido para users autenticados sin perfil.

const Onboarding: React.FC = () => {
  const history = useHistory();
  const { user, loading: authLoading, isAuthed } = useAuth();
  const { profile: userDoc, loading: profileLoading, saveOnboarding } = useProfile();

  // Form state · arrancamos con los defaults (todos null hasta que el user elige).
  const [data, setData] = useState<UserProfile>(defaultProfile);
  // 5 pasos: 0 personal · 1 estilo · 2 objetivo · 3 personalización IA · 4 modo IA/manual
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  // Si elige modo='ai' al pulsar Finalizar mostramos el resumen del
  // perfil que se va a enviar a la IA antes de guardar. Si pulsa
  // "Modificar" cerramos el modal (puede usar Atrás para retroceder).
  // Si pulsa "Confirmar y generar" → saveOnboarding + redirect /app.
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  // Aviso médico/legal · obligatorio para avanzar del paso 1. No vive en
  // UserProfile — se persiste como timestamp en UserDocument.medicalDisclaimerAcceptedAt
  // dentro de saveOnboardingProfile.
  const [medicalAccepted, setMedicalAccepted] = useState(false);
  // Modo (IA / manual) + scope de IA · ambos null = aún no elegido,
  // fuerza al user a tocar alguna opción del paso 4. Si elige IA tiene
  // que elegir también qué genera (todo / menú+compra / solo menú /
  // solo entrenos) para poder Finalizar.
  const [modeChoice, setModeChoice] = useState<StepModeValue>({
    modo: null,
    aiScope: null,
  });

  // Prellenamos el nombre con displayName del Auth (si existe) usando el
  // patrón state-from-prop: se aplica en el primer render donde el user
  // está disponible y nombre todavía está vacío. Sin useEffect → no choca
  // con la regla react-hooks/set-state-in-effect.
  const [didPrefillName, setDidPrefillName] = useState(false);
  if (!didPrefillName && user?.displayName && !data.nombre) {
    setDidPrefillName(true);
    setData((d) => ({ ...d, nombre: user.displayName ?? '' }));
  }

  // Guardas: redirigimos según estado de auth y perfil.
  useEffect(() => {
    if (authLoading || profileLoading) return;
    // Sin sesión → landing
    if (!isAuthed) {
      history.replace('/');
      return;
    }
    // Invitado: el onboarding requiere cuenta real (Firestore + reglas)
    if (user?.isAnonymous) {
      history.replace('/app');
      return;
    }
    // Ya completado → directo al dashboard
    if (userDoc?.profile?.completed) {
      history.replace('/app');
    }
  }, [authLoading, profileLoading, isAuthed, user, userDoc, history]);

  // ── Validación por paso ──────────────────────────────────────────────
  const stepValid = useMemo(() => {
    if (step === 0) {
      return (
        data.nombre.trim().length >= 2 &&
        data.edad !== null && data.edad >= 14 && data.edad <= 90 &&
        data.peso !== null && data.peso >= 30 && data.peso <= 300 &&
        data.altura !== null && data.altura >= 120 && data.altura <= 230 &&
        data.sexo !== null &&
        medicalAccepted
      );
    }
    if (step === 1) {
      return (
        data.actividad !== null &&
        data.diasEntreno !== null && data.diasEntreno >= 0 && data.diasEntreno <= 7 &&
        data.equipamiento !== null
      );
    }
    if (step === 2) {
      return data.objetivo !== null;
    }
    if (step === 3) {
      // Personalización para la IA · todos los campos son OPCIONALES.
      // Avanzar siempre permitido. La IA usará lo que el user haya
      // rellenado (o nada, si lo deja en blanco).
      return true;
    }
    if (step === 4) {
      // Manual válido por sí solo. IA requiere scope elegido para que
      // la primera generación sepa qué generar.
      if (modeChoice.modo === 'manual') return true;
      if (modeChoice.modo === 'ai') return modeChoice.aiScope !== null;
      return false;
    }
    return false;
  }, [step, data, medicalAccepted, modeChoice]);

  const setField = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const toggleRestriccion = (r: Restriccion) => {
    setData((d) => {
      const has = d.restricciones.includes(r);
      return {
        ...d,
        restricciones: has
          ? d.restricciones.filter((x) => x !== r)
          : [...d.restricciones, r],
      };
    });
  };

  const handleNext = () => {
    if (!stepValid) return;
    if (step < 4) setStep((step + 1) as 0 | 1 | 2 | 3 | 4);
  };

  const handleBack = () => {
    if (step > 0) setStep((step - 1) as 0 | 1 | 2 | 3 | 4);
  };

  // Pulsa Finalizar:
  //  - manual → guardar y entrar a /app directamente
  //  - ai     → abrir resumen del perfil para confirmar antes de guardar
  const handleSubmit = () => {
    if (!stepValid || modeChoice.modo === null) return;
    if (modeChoice.modo === 'ai') {
      setAiSummaryOpen(true);
      return;
    }
    void persistAndExit();
  };

  // Persiste el perfil completo en Firestore + redirige al shell. Llamado
  // desde handleSubmit (manual) o desde "Confirmar y generar" en el resumen.
  const persistAndExit = async () => {
    if (!stepValid || modeChoice.modo === null) return;
    setError('');
    setSubmitting(true);
    try {
      // Inyectamos modo + aiScope del paso 4 en el perfil que se persiste.
      // Si modo='manual', aiScope es null por construcción del StepMode.
      await saveOnboarding({
        ...data,
        modo: modeChoice.modo,
        aiScope: modeChoice.aiScope,
      });
      // FASE 6 PENDIENTE · si modo='ai' aquí dispararíamos la primera
      // generación llamando a la Cloud Function `generatePlan(scope=aiScope)`.
      // Por ahora el shell muestra empty states + botón "Generar con IA"
      // que el user tendrá que pulsar (toast informativo).
      history.replace('/app');
    } catch (err) {
      console.error('[BTal] saveOnboarding error:', err);
      setError('No hemos podido guardar tu perfil. Inténtalo de nuevo.');
      setAiSummaryOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // useAuth detectará el cambio y el efecto de arriba redirige a /
    } catch (err) {
      console.error('[BTal] signOut error:', err);
    }
  };

  if (authLoading || profileLoading || !user) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="onboarding-loading">
            <IonSpinner name="dots" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="onboarding-bg">
          <div className="onboarding-card">
            {/* Progreso · 5 puntos (personal · estilo · objetivo · personalización IA · modo) */}
            <div className="onboarding-progress">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={
                    'onboarding-progress-dot' +
                    (i < step ? ' done' : '') +
                    (i === step ? ' active' : '')
                  }
                />
              ))}
              <span className="onboarding-progress-label">Paso {step + 1} de 5</span>
            </div>

            {/* ─────────────────── PASO 0 — PERSONAL ─────────────────── */}
            {step === 0 && (
              <>
                <h1 className="onboarding-title">Cuéntanos sobre ti</h1>
                <p className="onboarding-text">
                  Necesitamos algunos datos para ajustar tu plan a tu cuerpo y objetivo.
                </p>

                <label className="onboarding-field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    placeholder="Pablo"
                    value={data.nombre}
                    onChange={(e) => setField('nombre', e.target.value)}
                    autoComplete="given-name"
                    maxLength={32}
                  />
                </label>

                <div className="onboarding-row">
                  <label className="onboarding-field">
                    <span>Edad</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={14}
                      max={90}
                      maxLength={3}
                      placeholder="28"
                      value={data.edad ?? ''}
                      onChange={(e) => setField('edad', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                  <label className="onboarding-field">
                    <span>Sexo</span>
                    <div className="onboarding-segment">
                      <button
                        type="button"
                        className={data.sexo === 'm' ? 'active' : ''}
                        onClick={() => setField('sexo', 'm' as Sexo)}
                      >
                        Hombre
                      </button>
                      <button
                        type="button"
                        className={data.sexo === 'f' ? 'active' : ''}
                        onClick={() => setField('sexo', 'f' as Sexo)}
                      >
                        Mujer
                      </button>
                    </div>
                  </label>
                </div>

                <div className="onboarding-row">
                  <label className="onboarding-field">
                    <span>Peso (kg)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={30}
                      max={300}
                      step="0.1"
                      maxLength={5}
                      placeholder="75"
                      value={data.peso ?? ''}
                      onChange={(e) => setField('peso', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                  <label className="onboarding-field">
                    <span>Altura (cm)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={120}
                      max={230}
                      maxLength={3}
                      placeholder="178"
                      value={data.altura ?? ''}
                      onChange={(e) => setField('altura', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                </div>

                {/* Aviso médico/legal · obligatorio (roadmap 14-2). No
                    podemos publicar la app en stores sin esto. */}
                <label className="onboarding-disclaimer">
                  <input
                    type="checkbox"
                    checked={medicalAccepted}
                    onChange={(e) => setMedicalAccepted(e.target.checked)}
                  />
                  <span>
                    He leído y entiendo que <strong>BTal no es un servicio
                    médico</strong> y los planes que genera no sustituyen el
                    consejo de un profesional sanitario. Si tengo alguna
                    condición médica, lesión, embarazo, alergia o trastorno
                    alimentario, consultaré a un profesional antes de seguir
                    el plan. (<a
                      href="/legal/aviso-medico"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >Leer el aviso completo</a>)
                  </span>
                </label>
              </>
            )}

            {/* ─────────────── PASO 1 — ESTILO DE VIDA ──────────────── */}
            {step === 1 && (
              <>
                <h1 className="onboarding-title">Tu estilo de vida</h1>
                <p className="onboarding-text">
                  Cuanto te muevas y dónde entrenes condicionan el plan.
                </p>

                <span className="onboarding-field-label">Nivel de actividad</span>
                <div className="onboarding-options">
                  {NIVELES_ACTIVIDAD.map((n) => (
                    <button
                      key={n.value}
                      type="button"
                      className={'onboarding-option' + (data.actividad === n.value ? ' active' : '')}
                      onClick={() => setField('actividad', n.value as NivelActividad)}
                    >
                      <span className="onboarding-option-title">{n.label}</span>
                      <span className="onboarding-option-sub">{n.sub}</span>
                    </button>
                  ))}
                </div>

                <label className="onboarding-field">
                  <span>Días de entreno por semana</span>
                  <div className="onboarding-days">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={'onboarding-day' + (data.diasEntreno === n ? ' active' : '')}
                        onClick={() => setField('diasEntreno', n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </label>

                <span className="onboarding-field-label">Equipamiento disponible</span>
                <div className="onboarding-options">
                  {EQUIPAMIENTOS.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      className={'onboarding-option' + (data.equipamiento === e.value ? ' active' : '')}
                      onClick={() => setField('equipamiento', e.value as Equipamiento)}
                    >
                      <span className="onboarding-option-title">{e.label}</span>
                      <span className="onboarding-option-sub">{e.sub}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ───────────────── PASO 2 — OBJETIVO ──────────────────── */}
            {step === 2 && (
              <>
                <h1 className="onboarding-title">Tu objetivo</h1>
                <p className="onboarding-text">
                  Esto define las calorías y macros del plan.
                </p>

                <span className="onboarding-field-label">¿Qué quieres conseguir?</span>
                <div className="onboarding-options">
                  {OBJETIVOS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={'onboarding-option' + (data.objetivo === o.value ? ' active' : '')}
                      onClick={() => setField('objetivo', o.value as Objetivo)}
                    >
                      <span className="onboarding-option-title">{o.label}</span>
                      <span className="onboarding-option-sub">{o.sub}</span>
                    </button>
                  ))}
                </div>

                <span className="onboarding-field-label">
                  Restricciones alimentarias <span className="onboarding-optional">opcional</span>
                </span>
                <div className="onboarding-pills">
                  {RESTRICCIONES.map((r) => {
                    const active = data.restricciones.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        className={'onboarding-pill' + (active ? ' active' : '')}
                        onClick={() => toggleRestriccion(r.value)}
                      >
                        {active && <MealIcon value="tb:circle-check-filled" size={16} />}
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ───────── PASO 3 — PERSONALIZACIÓN PARA LA IA (opcional) ───────── */}
            {step === 3 && (
              <>
                <h1 className="onboarding-title">Personaliza tu plan</h1>
                <p className="onboarding-text">
                  Todo este paso es <strong>opcional</strong>. Cuanta más
                  información nos des, mejor podrá la IA personalizar tu menú
                  y tu plan de entreno. Puedes dejar lo que no quieras rellenar
                  y editarlo después en Ajustes.
                </p>

                <CollapsibleSection
                  title="Cuéntanos más"
                  subtitle="Objetivos específicos, lesiones, preferencias…"
                  badge={data.notas.trim() ? '✓' : undefined}
                >
                  <textarea
                    className="onboarding-textarea"
                    placeholder="Ej: quiero ganar masa muscular sin perder definición · tengo dolor en el hombro derecho · prefiero recetas rápidas entre semana · …"
                    value={data.notas}
                    maxLength={1000}
                    rows={4}
                    onChange={(e) => setField('notas', e.target.value)}
                  />
                  <span className="onboarding-counter">
                    {data.notas.length} / 1000
                  </span>
                </CollapsibleSection>

                <CollapsibleSection
                  title="Alergias"
                  subtitle="Las 14 declarables del Reglamento UE + lo que añadas"
                  badge={data.alergias.length > 0 ? data.alergias.length : undefined}
                >
                  <span className="onboarding-field-label">Más comunes</span>
                  <div className="onboarding-pills">
                    {ALERGIAS_COMUNES.map((a) => {
                      const active = data.alergias.includes(a.value);
                      return (
                        <button
                          key={a.value}
                          type="button"
                          className={'onboarding-pill' + (active ? ' coral' : '')}
                          onClick={() =>
                            setField('alergias', toggleInArray(data.alergias, a.value))
                          }
                        >
                          {active && <MealIcon value="tb:circle-check-filled" size={16} />}
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="onboarding-field-label">Otras alergias</span>
                  <ChipsInput
                    color="coral"
                    placeholder="Escribe y pulsa Enter (ej: melocotón)"
                    value={data.alergias.filter(
                      (v) => !ALERGIAS_COMUNES.some((a) => a.value === v),
                    )}
                    onChange={(custom) => {
                      // Mantenemos las predefinidas + reemplazamos las custom.
                      const predefinidas = data.alergias.filter((v) =>
                        ALERGIAS_COMUNES.some((a) => a.value === v),
                      );
                      setField('alergias', [...predefinidas, ...custom]);
                    }}
                    ariaLabel="Añadir otra alergia"
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Intolerancias"
                  subtitle="Lactosa, fructosa, FODMAP… o lo que necesites"
                  badge={data.intolerancias.length > 0 ? data.intolerancias.length : undefined}
                >
                  <span className="onboarding-field-label">Más comunes</span>
                  <div className="onboarding-pills">
                    {INTOLERANCIAS_COMUNES.map((i) => {
                      const active = data.intolerancias.includes(i.value);
                      return (
                        <button
                          key={i.value}
                          type="button"
                          className={'onboarding-pill' + (active ? '' : '')}
                          onClick={() =>
                            setField('intolerancias', toggleInArray(data.intolerancias, i.value))
                          }
                          style={
                            active
                              ? {
                                  background: 'rgba(240, 168, 56, 0.12)',
                                  borderColor: 'var(--btal-gold)',
                                  color: 'var(--btal-gold)',
                                }
                              : undefined
                          }
                        >
                          {active && <MealIcon value="tb:circle-check-filled" size={16} />}
                          {i.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="onboarding-field-label">Otras intolerancias</span>
                  <ChipsInput
                    color="violet"
                    placeholder="Escribe y pulsa Enter"
                    value={data.intolerancias.filter(
                      (v) => !INTOLERANCIAS_COMUNES.some((a) => a.value === v),
                    )}
                    onChange={(custom) => {
                      const predefinidas = data.intolerancias.filter((v) =>
                        INTOLERANCIAS_COMUNES.some((a) => a.value === v),
                      );
                      setField('intolerancias', [...predefinidas, ...custom]);
                    }}
                    ariaLabel="Añadir otra intolerancia"
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Alimentos prohibidos"
                  subtitle="No quiero ver esto en mis comidas"
                  badge={data.alimentosProhibidos.length > 0 ? data.alimentosProhibidos.length : undefined}
                >
                  <ChipsInput
                    color="coral"
                    placeholder="Ej: hígado, coliflor, atún…"
                    value={data.alimentosProhibidos}
                    onChange={(v) => setField('alimentosProhibidos', v)}
                    ariaLabel="Añadir alimento prohibido"
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Alimentos obligatorios"
                  subtitle="Quiero que aparezcan sí o sí"
                  badge={data.alimentosObligatorios.length > 0 ? data.alimentosObligatorios.length : undefined}
                >
                  <ChipsInput
                    color="cyan"
                    placeholder="Ej: salmón al menos 2 veces, arroz a diario…"
                    value={data.alimentosObligatorios}
                    onChange={(v) => setField('alimentosObligatorios', v)}
                    ariaLabel="Añadir alimento obligatorio"
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Ingredientes favoritos"
                  subtitle="La IA los priorizará en el plan"
                  badge={data.ingredientesFavoritos.length > 0 ? data.ingredientesFavoritos.length : undefined}
                >
                  <ChipsInput
                    color="lime"
                    placeholder="Ej: aguacate, huevos, espinacas…"
                    value={data.ingredientesFavoritos}
                    onChange={(v) => setField('ingredientesFavoritos', v)}
                    ariaLabel="Añadir ingrediente favorito"
                  />
                </CollapsibleSection>
              </>
            )}

            {/* ───────────────── PASO 4 — MODO IA / MANUAL ──────────── */}
            {step === 4 && (
              <>
                <h1 className="onboarding-title">¿Cómo quieres empezar?</h1>
                <p className="onboarding-text">
                  Puedes dejar que la IA genere tu plan a partir de tus datos
                  o partir de plantillas vacías y rellenarlas tú. Podrás cambiar
                  esta decisión en cualquier momento desde Ajustes.
                </p>

                <StepMode value={modeChoice} onChange={setModeChoice} />

                {/* Recordatorio en sentence case · cuando el user elige
                    "todo" entiende mejor lo que va a pasar al Finalizar. */}
                {modeChoice.modo === 'ai' && modeChoice.aiScope === null && (
                  <p className="onboarding-text" style={{ color: 'var(--btal-gold)' }}>
                    Falta elegir qué quieres que genere la IA antes de continuar.
                  </p>
                )}
              </>
            )}

            {error && <div className="landing-msg error">{error}</div>}

            {/* ────── Navegación ────── */}
            <div className="onboarding-nav">
              {step > 0 ? (
                <IonButton
                  type="button"
                  fill="outline"
                  className="onboarding-back"
                  onClick={handleBack}
                  disabled={submitting}
                  aria-label={`Volver al paso ${step} de 5 — corregir lo que ya rellenaste`}
                >
                  <MealIcon value="tb:arrow-left" size={18} slot="start" />
                  Atrás
                </IonButton>
              ) : (
                <span />
              )}

              {step < 4 ? (
                <IonButton
                  type="button"
                  className="onboarding-next"
                  onClick={handleNext}
                  disabled={!stepValid}
                >
                  Siguiente
                  <MealIcon value="tb:arrow-right" size={18} slot="end" />
                </IonButton>
              ) : (
                <IonButton
                  type="button"
                  className="onboarding-next"
                  onClick={handleSubmit}
                  disabled={!stepValid || submitting}
                >
                  {submitting ? <IonSpinner name="dots" /> : 'Finalizar'}
                </IonButton>
              )}
            </div>

            {/* Escape hatch para usuarios que no quieran completar el
                onboarding ahora. Cerramos sesión y vuelven a la landing. */}
            <button
              type="button"
              className="onboarding-skip"
              onClick={() => setConfirmLogoutOpen(true)}
              disabled={submitting}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <IonAlert
          isOpen={confirmLogoutOpen}
          onDidDismiss={() => setConfirmLogoutOpen(false)}
          header="¿Cerrar sesión sin completar?"
          message="Si cierras sesión ahora, los datos que has rellenado se perderán. La próxima vez que entres tendrás que empezar de nuevo."
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Cerrar sesión',
              role: 'destructive',
              handler: () => {
                handleLogout();
              },
            },
          ]}
        />

        {/* Resumen del perfil que se enviará a la IA · solo aparece si el
            usuario eligió modo='ai' en el paso 4 al pulsar Finalizar.
            En "Modificar" cierra el modal · el user puede usar Atrás para
            cambiar lo que necesite. */}
        {aiSummaryOpen && modeChoice.modo === 'ai' && modeChoice.aiScope !== null && (
          <AiPromptSummaryModal
            isOpen={aiSummaryOpen}
            onClose={() => setAiSummaryOpen(false)}
            scope={modeChoice.aiScope}
            profileOverride={{
              ...data,
              modo: modeChoice.modo,
              aiScope: modeChoice.aiScope,
            }}
            onConfirm={() => void persistAndExit()}
            onModify={() => setAiSummaryOpen(false)}
            confirmLabel="Confirmar y generar"
            submitting={submitting}
          />
        )}

        {/* GeneratingScreen mientras se persiste el perfil + (Fase 6) se
            llama a la Cloud Function `generatePlan`. Submitting=true
            cubre el momento entre Confirmar y la redirección a /app. */}
        <GeneratingScreen
          isOpen={submitting && modeChoice.modo === 'ai'}
          title="Generando tu plan inicial"
          subtitle="Estamos guardando tu perfil y preparando tu plan personalizado. No cierres la app."
        />
      </IonContent>
    </IonPage>
  );
};

export default Onboarding;
