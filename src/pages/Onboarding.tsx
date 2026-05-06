import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import {
  arrowBackOutline,
  arrowForwardOutline,
  checkmarkCircle,
} from 'ionicons/icons';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { signOut } from '../services/auth';
import {
  EQUIPAMIENTOS,
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

// Si el usuario ya completó onboarding nos largamos directo a /app.
// Esta página solo tiene sentido para users autenticados sin perfil.

const Onboarding: React.FC = () => {
  const history = useHistory();
  const { user, loading: authLoading, isAuthed } = useAuth();
  const { profile: userDoc, loading: profileLoading, saveOnboarding } = useProfile();

  // Form state · arrancamos con los defaults (todos null hasta que el user elige).
  const [data, setData] = useState<UserProfile>(defaultProfile);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

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
        data.sexo !== null
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
    return false;
  }, [step, data]);

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
    if (step < 2) setStep((step + 1) as 0 | 1 | 2);
  };

  const handleBack = () => {
    if (step > 0) setStep((step - 1) as 0 | 1 | 2);
  };

  const handleSubmit = async () => {
    if (!stepValid) return;
    setError('');
    setSubmitting(true);
    try {
      await saveOnboarding(data);
      history.replace('/app');
    } catch (err) {
      console.error('[BTal] saveOnboarding error:', err);
      setError('No hemos podido guardar tu perfil. Inténtalo de nuevo.');
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
            {/* Progreso · 3 puntos */}
            <div className="onboarding-progress">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={
                    'onboarding-progress-dot' +
                    (i < step ? ' done' : '') +
                    (i === step ? ' active' : '')
                  }
                />
              ))}
              <span className="onboarding-progress-label">Paso {step + 1} de 3</span>
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
                      placeholder="178"
                      value={data.altura ?? ''}
                      onChange={(e) => setField('altura', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                </div>
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
                        {active && <IonIcon icon={checkmarkCircle} />}
                        {r.label}
                      </button>
                    );
                  })}
                </div>
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
                >
                  <IonIcon icon={arrowBackOutline} slot="start" />
                  Atrás
                </IonButton>
              ) : (
                <span />
              )}

              {step < 2 ? (
                <IonButton
                  type="button"
                  className="onboarding-next"
                  onClick={handleNext}
                  disabled={!stepValid}
                >
                  Siguiente
                  <IonIcon icon={arrowForwardOutline} slot="end" />
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
      </IonContent>
    </IonPage>
  );
};

export default Onboarding;
