import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useProfile } from '../hooks/useProfile';
import { usePreferences } from '../hooks/usePreferences';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { ChipsInput } from './ChipsInput';
import { CollapsibleSection } from './CollapsibleSection';
import { SaveIndicator } from './SaveIndicator';
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

// Shape estable para inyectar en `calcularObjetivoKcal` con los valores
// del form (que solo tiene parte del UserProfile). El cálculo solo lee
// edad/peso/altura/sexo/actividad/objetivo, los demás son irrelevantes.
const defaultProfileShape = defaultProfile();

// Helper local · alterna un valor en una lista de strings.
function toggleArr(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

// Compara dos arrays de strings sin importar orden.
function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
import {
  cmToFeetInches,
  inToCm,
  kgToLb,
  lbToKg,
} from '../utils/units';
import { calcularObjetivoKcal } from '../utils/calorias';
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
    notas: p.notas ?? '',
    intolerancias: [...(p.intolerancias ?? [])],
    alergias: [...(p.alergias ?? [])],
    alimentosProhibidos: [...(p.alimentosProhibidos ?? [])],
    alimentosObligatorios: [...(p.alimentosObligatorios ?? [])],
    ingredientesFavoritos: [...(p.ingredientesFavoritos ?? [])],
    objetivoKcal: p.objetivoKcal ?? null,
  };
}

// Lista de campos que son arrays de strings · necesitan diff por contenido,
// no por igualdad referencial.
const ARRAY_KEYS: (keyof EditableProfile)[] = [
  'restricciones',
  'intolerancias',
  'alergias',
  'alimentosProhibidos',
  'alimentosObligatorios',
  'ingredientesFavoritos',
];

// Diff superficial: solo emite los campos que han cambiado. Para los
// arrays comparamos por contenido (orden no importa).
function diffEditable(
  before: EditableProfile,
  after: EditableProfile,
): Partial<EditableProfile> {
  const out: Record<string, unknown> = {};
  (Object.keys(after) as (keyof EditableProfile)[]).forEach((key) => {
    if (ARRAY_KEYS.includes(key)) {
      const a = before[key] as string[];
      const b = after[key] as string[];
      if (!sameArray(a, b)) {
        out[key] = b;
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
    notas: '',
    intolerancias: [],
    alergias: [],
    alimentosProhibidos: [],
    alimentosObligatorios: [],
    ingredientesFavoritos: [],
    objetivoKcal: null,
  };
  const [original, setOriginal] = useState<EditableProfile>(empty);
  const [data, setData] = useState<EditableProfile>(empty);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: { partial: Partial<EditableProfile>; data: EditableProfile };
  } | null>(null);
  // Status del guardado · sincronizado con el await a Firestore vía
  // updateProfile. Se muestra como SaveIndicator al lado del botón.
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';
  // Timer del cierre tras "Guardado" · cleanup al desmontar y al
  // iniciar otro guardado para evitar cierres dobles.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

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
    setConfirmChanges(null);
    resetSave();
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

  const handleSave = () => {
    if (!valid || !dirty || submitting) return;
    setError('');
    const partial = diffEditable(original, data);
    // Diff editable es siempre edit (el perfil ya existe).
    const changes: ChangeEntry[] = [];
    pushDiff(changes, 'Nombre', original.nombre, data.nombre);
    pushDiff(changes, 'Edad', original.edad, data.edad);
    pushDiff(changes, 'Peso (kg)', original.peso, data.peso);
    pushDiff(changes, 'Altura (cm)', original.altura, data.altura);
    pushDiff(
      changes,
      'Sexo',
      original.sexo === 'm' ? 'Hombre' : original.sexo === 'f' ? 'Mujer' : null,
      data.sexo === 'm' ? 'Hombre' : data.sexo === 'f' ? 'Mujer' : null,
    );
    pushDiff(changes, 'Actividad', original.actividad, data.actividad);
    pushDiff(changes, 'Días entreno', original.diasEntreno, data.diasEntreno);
    pushDiff(changes, 'Equipamiento', original.equipamiento, data.equipamiento);
    pushDiff(changes, 'Objetivo', original.objetivo, data.objetivo);
    pushDiff(
      changes,
      'Restricciones',
      original.restricciones.join(', '),
      data.restricciones.join(', '),
    );
    pushDiff(changes, 'Notas', original.notas, data.notas);
    setConfirmChanges({ changes, cleaned: { partial, data } });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const { partial, data: nextData } = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(() =>
      updateProfile(partial as Partial<UserProfile>),
    );
    if (result === SAVE_FAILED) {
      // Falló · el SaveIndicator ya muestra "Error" 3s.
      setError('No hemos podido guardar los cambios. Inténtalo de nuevo.');
      return;
    }
    setOriginal(nextData);
    // Esperamos a que el chip "Guardado" se vea antes de cerrar.
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetForm}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <IonContent>
          <div className="edit-fp-bg">
            <div className="edit-fp-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onClose();
                }}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
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
                    maxLength={3}
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
                      maxLength={5}
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
                      maxLength={5}
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
                        maxLength={1}
                        value={feetInput}
                        placeholder="ft"
                        onChange={(e) => onHeightImperialChange(e.target.value, inchesInput)}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={11}
                        maxLength={2}
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
                      maxLength={3}
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
                      {active && <MealIcon value="tb:circle-check-filled" size={16} />}
                      {r.label}
                    </button>
                  );
                })}
              </div>

              {/* Objetivo de kcal · calculado automáticamente desde edad/
                  peso/altura/sexo/actividad/objetivo, o sobreescrito a mano
                  por el user. Si lo dejas vacío, la app usa el calculado. */}
              {(() => {
                // Para mostrar el sugerido en el placeholder usamos un perfil
                // "completo" con los valores actuales del form (no del doc).
                const sugerido = calcularObjetivoKcal({
                  ...defaultProfileShape,
                  edad: data.edad,
                  peso: data.peso,
                  altura: data.altura,
                  sexo: data.sexo,
                  actividad: data.actividad,
                  objetivo: data.objetivo,
                });
                return (
                  <label className="onboarding-field">
                    <span>Objetivo de kcal/día</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1000}
                      max={6000}
                      step={10}
                      maxLength={5}
                      placeholder={sugerido ? `Sugerido: ${sugerido} kcal` : 'Necesitas rellenar tu perfil'}
                      value={data.objetivoKcal ?? ''}
                      onChange={(e) =>
                        setField(
                          'objetivoKcal',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                    <span
                      className="onboarding-counter"
                      style={{ textAlign: 'left', marginTop: 4 }}
                    >
                      {sugerido
                        ? `Calculado: ${sugerido} kcal · puedes ajustarlo o dejarlo vacío para usar el sugerido.`
                        : 'Rellena edad, peso, altura, sexo, actividad y objetivo para ver el sugerido.'}
                    </span>
                  </label>
                );
              })()}

              {/* ════════ PERSONALIZACIÓN PARA LA IA ════════ */}
              <h3 className="edit-fp-section-title">Personalización para la IA</h3>
              <p className="settings-modal-text" style={{ margin: '0 0 4px' }}>
                Datos que la IA usará al generar tu plan. Todo opcional.
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
                <span className="onboarding-counter">{data.notas.length} / 1000</span>
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
                        onClick={() => setField('alergias', toggleArr(data.alergias, a.value))}
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
                        className="onboarding-pill"
                        onClick={() =>
                          setField('intolerancias', toggleArr(data.intolerancias, i.value))
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

              {error && <div className="landing-msg error">{error}</div>}

              {/* SaveIndicator centrado · sincronizado con runSave */}
              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
              </div>

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={handleSave}
                disabled={!valid || !dirty || submitting}
              >
                <MealIcon value="tb:circle-check-filled" size={18} slot="start" />
                Guardar cambios
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed fitness:', err),
          );
        }}
      />

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
