import { IonContent, IonModal } from '@ionic/react';
import { MealIcon } from './MealIcon';
import type { PlanEntreno } from '../templates/defaultUser';
import { badgeLabel, BADGE_BY_VAL } from '../templates/exerciseCatalog';
import { formatDiaSemana } from '../utils/diaSemana';
import { formatTiempoEstimado } from '../utils/timeParser';
import './TrainSheet.css';

// Bottom sheet con el detalle completo de un día del plan de entreno.
// Réplica visual del preview (BTal_NewVersionPreview): badge día semana,
// título, descripción, tags, lista completa de ejercicios + comentario,
// botón "Editar día" que cierra el sheet y abre el DiaEditorModal.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanEntreno;
  diaIdx: number;
  onEdit: () => void;
}

export function TrainSheet({ isOpen, onClose, plan, diaIdx, onEdit }: Props) {
  const dia = plan.dias[diaIdx];
  if (!dia) return null;

  const tags = [
    { val: dia.badge, custom: dia.badgeCustom },
    { val: dia.badge2, custom: dia.badgeCustom2 },
    { val: dia.badge3, custom: dia.badgeCustom3 },
  ]
    .map((b) => ({
      label: b.val ? badgeLabel(b.val, b.custom) : null,
      cls: b.val ? BADGE_BY_VAL[b.val]?.cls ?? '' : '',
    }))
    .filter((b) => b.label !== null) as { label: string; cls: string }[];

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="train-sheet"
      initialBreakpoint={0.92}
      breakpoints={[0, 0.5, 0.92, 1]}
    >
      <IonContent>
        <div className="train-sheet-content">
          <div className="train-sheet-head">
            <div className="train-sheet-head-left">
              {dia.diaSemana && (
                <span className="train-sheet-week">
                  {formatDiaSemana(dia.diaSemana)}
                </span>
              )}
              {/* Tiempo estimado · pill azul a la derecha del día
                  semana · mismo color que el badge en la card de
                  Entreno de Hoy para coherencia visual. */}
              {dia.tiempoEstimadoMin && dia.tiempoEstimadoMin > 0 && (
                <span className="train-sheet-time">
                  <MealIcon value="tb:clock" size={12} />
                  {formatTiempoEstimado(dia.tiempoEstimadoMin)}
                </span>
              )}
            </div>
            <button
              type="button"
              className="train-sheet-close"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                onClose();
              }}
              aria-label="Cerrar"
            >
              <MealIcon value="tb:x" size={22} />
            </button>
          </div>

          <h2 className="train-sheet-title">
            {dia.titulo || 'Día sin título'}
          </h2>
          {dia.descripcion && (
            <div className="train-sheet-sub">{dia.descripcion}</div>
          )}

          {tags.length > 0 && (
            <div className="train-tags train-sheet-tags">
              {tags.map((t, i) => (
                <span key={i} className={`tag ${t.cls}`}>
                  {t.label}
                </span>
              ))}
            </div>
          )}

          {dia.ejercicios.length === 0 ? (
            <div className="train-sheet-empty">
              <p>Aún no hay ejercicios en este día.</p>
            </div>
          ) : (
            <div className="train-sheet-exercises">
              {dia.ejercicios.map((ex, i) => (
                <div key={i} className="exercise-row">
                  <div className="exercise-name">
                    {ex.nombre}
                    {ex.desc && <span>{ex.desc}</span>}
                  </div>
                  <div className="exercise-sets">{ex.series}</div>
                </div>
              ))}
            </div>
          )}

          {dia.comentario && (
            <div className="train-sheet-note">{dia.comentario}</div>
          )}

          <div className="train-sheet-actions">
            <button
              type="button"
              className="train-sheet-edit-btn"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                onEdit();
              }}
            >
              <MealIcon value="tb:edit" size={18} />
              Editar día
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
