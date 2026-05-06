import { useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { checkmarkCircle, closeOutline } from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import { usePreferences } from '../hooks/usePreferences';
import {
  EQUIPAMIENTOS,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  RESTRICCIONES,
  type Equipamiento,
  type NivelActividad,
  type Objetivo,
  type Restriccion,
  type Sexo,
  type UserProfile,
} from '../templates/defaultUser';
import {
  cmToFeetInches,
  inToCm,
  kgToLb,
  lbToKg,
} from '../utils/units';
import '../pages/Onboarding.css';
import './SettingsModal.css';
import './EditFitnessProfileModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Campos editables del perfil — los mismos del onboarding, sin el flag
// `completed` (ese solo lo toca saveOnboardingProfile) ni `modo` (todavía
// solo manual). El usuario puede abrir esto desde Settings → Administrar
// cuenta → "Editar datos del perfil".
// Editable: todo lo del perfil EXCEPTO el flag de completado, el modo
// (IA/manual · se cambia desde "Modo de generación" en Settings) y el
// aiScope (lo decide StepMode junto al modo, no aquí).
type EditableProfile = Omit<UserProfile, 'completed' | 'modo' | 'aiScope'>;

function profileToEditable(p: UserProfile): EditableProfile {
  return {
    nombre: p.nombre,
    edad: p.edad,
    peso: p.peso,
    altura: p.altura,
    sexo: p.sexo,
    actividad: p.actividad,
    diasEntreno: p.diasEntreno,
    equipamiento: p.equipamiento,
    objetivo: p.objetivo,
    restricciones: [...p.restricciones],
  };
}

// Diff superficial: solo emite los campos que han cambiado. Para
// `restricciones` comparamos por longitud + contenido (orden no importa).
function diffEditable(
  before: EditableProfile,
  after: EditableProfile,
): Partial<EditableProfile> {
  const out: Record<string, unknown> = {};
  (Object.keys(after) as (keyof EditableProfile)[]).forEach((key) => {
    if (key === 'restricciones') {
      const a = [...before.restricciones].sort();
      const b = [...after.restricciones].sort();
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
        out.restricciones = after.restricciones;
      }
      return;
    }
    if (before[key] !== after[key]) {
      out[key] = after[key];
    }
  });
  return out as Partial<EditableProfile>;
}

export function EditFitnessProfileModal({ isOpen, onClose }: Props) {
  const { profile: userDoc, updateProfile } = useProfile();
  const { units } = usePreferences();
  const imperial = units === 'imperial';

  // Form state · arranca vacío y se rellena en onWillPresent con los
  // valores actuales del perfil.
  const empty: EditableProfile = {
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
  };
  const [original, setOriginal] = useState<EditableProfile>(empty);
  const [data, setData] = useState<EditableProfile>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  // Inputs imperiales locales (string) — separados del estado canónico
  // (peso/altura siempre en kg/cm) para evitar truncamientos por redondeo
  // mientras el usuario escribe.
  const [pesoLbInput, setPesoLbInput] = useState('');
  const [feetInput, setFeetInput] = useState('');
  const [inchesInput, setInchesInput] = useState('');

  const resetForm = () => {
    if (!userDoc?.profile) return;
    const seed = profileToEditable(userDoc.profile);
    setOriginal(seed);
    setData(seed);
    setError('');
    // Pre-rellenamos los inputs imperiales con los valores convertidos.
    setPesoLbInput(seed.peso !== null ? String(Math.round(kgToLb(seed.peso))) : '');
    if (seed.altura !== null) {
      const { feet, inches } = cmToFeetInches(seed.altura);
      setFeetInput(String(feet));
      setInchesInput(String(inches));
    } else {
      setFeetInput('');
      setInchesInput('');
    }
  };

  const setField = <K extends keyof EditableProfile>(
    key: K,
    value: EditableProfile[K],
  ) => {
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

  // ── Inputs imperiales ──────────────────────────────────────────────
  // Cuando el usuario escribe en lb/ft/in, convertimos a kg/cm y guardamos
  // en `data` (canónico). Así la app sigue almacenando solo métrico.
  const onPesoLbChange = (raw: string) => {
    setPesoLbInput(raw);
    if (raw === '') {
      setField('peso', null);
      return;
    }
    const lb = Number(raw);
    if (Number.isFinite(lb)) {
      // Redondeamos a una décima de kg para evitar deriva por roundtrip.
      setField('peso', Math.round(lbToKg(lb) * 10) / 10);
    }
  };

  const onHeightImperialChange = (feetRaw: string, inchesRaw: string) => {
    setFeetInput(feetRaw);
    setInchesInput(inchesRaw);
    if (feetRaw === '' && inchesRaw === '') {
      setField('altura', null);
      return;
    }
    const feet = Number(feetRaw) || 0;
    const inches = Number(inchesRaw) || 0;
    const totalIn = feet * 12 + inches;
    if (Number.isFinite(totalIn) && totalIn > 0) {
      setField('altura', Math.round(inToCm(totalIn)));
    }
  };

  // ── Validación ────────────────────────────────────────────────────
  const valid = useMemo(() => {
    return (
      data.nombre.trim().length >= 2 &&
      data.edad !== null && data.edad >= 14 && data.edad <= 90 &&
      data.peso !== null && data.peso >= 30 && data.peso <= 300 &&
      data.altura !== null && data.altura >= 120 && data.altura <= 230 &&
      data.sexo !== null &&
      data.actividad !== null &&
      data.diasEntreno !== null && data.diasEntreno >= 0 && data.diasEntreno <= 7 &&
      data.equipamiento !== null &&
      data.objetivo !== null
    );
  }, [data]);

  const dirty = useMemo(() => {
    return Object.keys(diffEditable(original, data)).length > 0;
  }, [original, data]);

  const handleSave = async () => {
    if (!valid || !dirty || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const partial = diffEditable(original, data);
      await updateProfile(partial as Partial<UserProfile>);
      setOriginal(data);
      setSavedToast(true);
      onClose();
    } catch (err) {
      console.error('[BTal] updateProfile error:', err);
      setError('No hemos podido guardar los cambios. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetForm}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <button
          type="button"
          className="settings-modal-close edit-fp-close-fixed"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>

        <IonContent>
          <div className="edit-fp-bg">
            <div className="edit-fp-card">
              <h2 className="settings-modal-title">Editar datos del perfil</h2>
              <p className="settings-modal-text">
                Cambia tu peso, objetivo o equipamiento. La próxima generación
                de plan usará estos valores.
              </p>

              {/* ════════ DATOS PERSONALES ════════ */}
              <h3 className="edit-fp-section-title">Datos personales</h3>

              <label className="onboarding-field">
                <span>Nombre</span>
                <input
                  type="text"
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
                    value={data.edad ?? ''}
                    onChange={(e) =>
                      setField('edad', e.target.value === '' ? null : Number(e.target.value))
                    }
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
                {/* Peso · cambia entre kg y lb según preferencia */}
                {imperial ? (
                  <label className="onboarding-field">
                    <span>Peso (lb)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={66}
                      max={660}
                      value={pesoLbInput}
                      onChange={(e) => onPesoLbChange(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="onboarding-field">
                    <span>Peso (kg)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={30}
                      max={300}
                      step="0.1"
                      value={data.peso ?? ''}
                      onChange={(e) =>
                        setField('peso', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </label>
                )}

                {/* Altura · cm o ft+in */}
                {imperial ? (
                  <label className="onboarding-field">
                    <span>Altura (ft / in)</span>
                    <div className="edit-fp-height-imperial">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={3}
                        max={7}
                        value={feetInput}
                        placeholder="ft"
                        onChange={(e) => onHeightImperialChange(e.target.value, inchesInput)}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={11}
                        value={inchesInput}
                        placeholder="in"
                        onChange={(e) => onHeightImperialChange(feetInput, e.target.value)}
                      />
                    </div>
                  </label>
                ) : (
                  <label className="onboarding-field">
                    <span>Altura (cm)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={120}
                      max={230}
                      value={data.altura ?? ''}
                      onChange={(e) =>
                        setField('altura', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </label>
                )}
              </div>

              {/* ════════ ESTILO DE VIDA ════════ */}
              <h3 className="edit-fp-section-title">Estilo de vida</h3>

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
                {EQUIPAMIENTOS.map((eq) => (
                  <button
                    key={eq.value}
                    type="button"
                    className={'onboarding-option' + (data.equipamiento === eq.value ? ' active' : '')}
                    onClick={() => setField('equipamiento', eq.value as Equipamiento)}
                  >
                    <span className="onboarding-option-title">{eq.label}</span>
                    <span className="onboarding-option-sub">{eq.sub}</span>
                  </button>
                ))}
              </div>

              {/* ════════ OBJETIVO ════════ */}
              <h3 className="edit-fp-section-title">Objetivo</h3>

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
                Restricciones alimentarias{' '}
                <span className="onboarding-optional">opcional</span>
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

              {error && <div className="landing-msg error">{error}</div>}

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={handleSave}
                disabled={!valid || !dirty || submitting}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <IonIcon icon={checkmarkCircle} slot="start" />
                    Guardar cambios
                  </>
                )}
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Datos del perfil guardados"
        duration={2000}
        position="bottom"
        color="success"
      />
    </>
  );
}
