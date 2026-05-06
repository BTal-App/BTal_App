import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonButton, IonIcon, IonModal } from '@ionic/react';
import {
  closeOutline,
  createOutline,
  logOutOutline,
  settingsOutline,
} from 'ionicons/icons';
import type { User } from 'firebase/auth';
import { useProfile } from '../hooks/useProfile';
import { usePreferences } from '../hooks/usePreferences';
import { signOut } from '../services/auth';
import { greetingName, initialsOf } from '../utils/userDisplay';
import { formatHeight, formatWeight } from '../utils/units';
import {
  EQUIPAMIENTOS,
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  RESTRICCIONES,
} from '../templates/defaultUser';
import { EditFitnessProfileModal } from './EditFitnessProfileModal';
import { blurAndRun } from '../utils/focus';
import './ProfileSheet.css';

interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
}

// IMC = peso(kg) / altura(m)². Devolvemos número o null si faltan datos.
function calcBMI(pesoKg: number | null, alturaCm: number | null): number | null {
  if (pesoKg === null || alturaCm === null || alturaCm === 0) return null;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Bajo peso', color: 'var(--btal-cyan)' };
  if (bmi < 25) return { label: 'Saludable', color: 'var(--btal-lime)' };
  if (bmi < 30) return { label: 'Sobrepeso', color: 'var(--btal-gold)' };
  return { label: 'Obesidad', color: 'var(--btal-coral)' };
}

// Bottom sheet con la información del perfil del usuario.
// Se abre al pulsar el avatar del header en cualquier tab del shell v2.
// Reusa la información que antes vivía en la tarjeta del Dashboard.
export function ProfileSheet({ isOpen, user, onClose }: Props) {
  const history = useHistory();
  const { profile: userDoc } = useProfile();
  const { units } = usePreferences();
  const [editFitnessOpen, setEditFitnessOpen] = useState(false);

  const p = userDoc?.profile;
  const completed = !!p?.completed;
  const bmi = p ? calcBMI(p.peso, p.altura) : null;
  const cat = bmi !== null ? bmiCategory(bmi) : null;

  const objetivoLabel = p?.objetivo
    ? OBJETIVOS.find((o) => o.value === p.objetivo)?.label ?? '—'
    : '—';
  const equipamientoLabel = p?.equipamiento
    ? EQUIPAMIENTOS.find((e) => e.value === p.equipamiento)?.label ?? '—'
    : '—';
  const actividadLabel = p?.actividad
    ? NIVELES_ACTIVIDAD.find((n) => n.value === p.actividad)?.label ?? '—'
    : '—';
  const restriccionesLabels = (p?.restricciones ?? [])
    .map((r) => RESTRICCIONES.find((x) => x.value === r)?.label)
    .filter((x): x is string => Boolean(x));

  // Mismo fallback que HoyPage: Auth.displayName → profile.nombre →
  // email → 'Perfil'. Cubre invitados (Auth anónimo, profile.nombre del
  // demoUser) y cuentas reales sin displayName en Auth.
  const profileFirstName = p?.nombre?.trim().split(/\s+/)[0] || null;
  const greetName =
    greetingName(user) ?? profileFirstName ?? user.email ?? 'Perfil';

  const handleLogout = async () => {
    await signOut();
    onClose();
    // useAuth detectará el cambio y App.tsx redirigirá a /
  };

  const handleSettings = () => {
    onClose();
    history.push('/settings');
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onDidDismiss={onClose}
        className="profile-sheet"
        breakpoints={[0, 0.85, 1]}
        initialBreakpoint={0.85}
        handle
      >
        <div className="profile-sheet-content">
          {/* Cabecera con avatar grande + nombre + cerrar */}
          <div className="profile-sheet-head">
            <div className="profile-sheet-avatar">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <span>
                  {user.displayName?.trim() || user.email
                    ? initialsOf(user.displayName, user.email)
                    : initialsOf(profileFirstName ?? null, null)}
                </span>
              )}
            </div>
            <div className="profile-sheet-id">
              <h2>{greetName}</h2>
              <p>{user.isAnonymous ? 'Sesión temporal · invitado' : user.email}</p>
            </div>
            <button
              type="button"
              className="profile-sheet-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          {/* Si el perfil aún no se ha completado, mostramos un estado vacío
              en vez de stats con guiones. Pasa con cuentas que no terminaron
              onboarding (raro porque el AppShell redirige) y con invitados. */}
          {!completed && (
            <div className="profile-sheet-empty">
              {user.isAnonymous
                ? 'Como invitado no tienes datos de perfil guardados. Crea una cuenta para personalizar tu plan.'
                : 'Aún no has completado tu perfil. Cuéntanos sobre ti para que podamos generar tu plan.'}
            </div>
          )}

          {completed && p && (
            <>
              {/* Stats principales (peso · altura · IMC con categoría) */}
              <div className="profile-sheet-stats">
                <div className="profile-sheet-stat">
                  <span className="profile-sheet-stat-label">Peso</span>
                  <span className="profile-sheet-stat-value">
                    {formatWeight(p.peso, units)}
                  </span>
                </div>
                <div className="profile-sheet-stat">
                  <span className="profile-sheet-stat-label">Altura</span>
                  <span className="profile-sheet-stat-value">
                    {formatHeight(p.altura, units)}
                  </span>
                </div>
                <div className="profile-sheet-stat">
                  <span className="profile-sheet-stat-label">IMC</span>
                  <span className="profile-sheet-stat-value">
                    {bmi !== null ? bmi.toFixed(1) : '—'}
                  </span>
                  {cat && (
                    <span
                      className="profile-sheet-stat-badge"
                      style={{ color: cat.color, borderColor: cat.color }}
                    >
                      {cat.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Bloque meta (objetivo · equipamiento · actividad · días) */}
              <div className="profile-sheet-meta">
                <div className="profile-sheet-meta-row">
                  <span className="profile-sheet-meta-label">Objetivo</span>
                  <span className="profile-sheet-meta-value profile-sheet-objetivo">
                    {objetivoLabel}
                  </span>
                </div>
                <div className="profile-sheet-meta-row">
                  <span className="profile-sheet-meta-label">Equipamiento</span>
                  <span className="profile-sheet-meta-value">{equipamientoLabel}</span>
                </div>
                <div className="profile-sheet-meta-row">
                  <span className="profile-sheet-meta-label">Actividad</span>
                  <span className="profile-sheet-meta-value">{actividadLabel}</span>
                </div>
                <div className="profile-sheet-meta-row">
                  <span className="profile-sheet-meta-label">Días de entreno</span>
                  <span className="profile-sheet-meta-value">
                    {p.diasEntreno !== null ? `${p.diasEntreno} / semana` : '—'}
                  </span>
                </div>
              </div>

              {restriccionesLabels.length > 0 && (
                <div className="profile-sheet-restricciones">
                  <span className="profile-sheet-meta-label">Restricciones</span>
                  <div className="profile-sheet-pills">
                    {restriccionesLabels.map((label) => (
                      <span key={label} className="profile-sheet-pill">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <IonButton
                type="button"
                expand="block"
                fill="outline"
                className="profile-sheet-action profile-sheet-action--edit"
                onClick={blurAndRun(() => setEditFitnessOpen(true))}
              >
                <IonIcon icon={createOutline} slot="start" />
                Editar datos del perfil
              </IonButton>
            </>
          )}

          {/* Acciones secundarias siempre visibles */}
          <IonButton
            type="button"
            expand="block"
            fill="outline"
            className="profile-sheet-action"
            onClick={blurAndRun(handleSettings)}
          >
            <IonIcon icon={settingsOutline} slot="start" />
            Ajustes
          </IonButton>

          <IonButton
            type="button"
            expand="block"
            fill="clear"
            className="profile-sheet-logout"
            onClick={handleLogout}
          >
            <IonIcon icon={logOutOutline} slot="start" />
            Cerrar sesión
          </IonButton>
        </div>
      </IonModal>

      {completed && (
        <EditFitnessProfileModal
          isOpen={editFitnessOpen}
          onClose={() => setEditFitnessOpen(false)}
        />
      )}
    </>
  );
}
