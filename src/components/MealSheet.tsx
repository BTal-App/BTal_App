import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
} from '@ionic/react';
import {
  barbellOutline,
  closeOutline,
  copyOutline,
  createOutline,
  flameOutline,
  leafOutline,
  trashOutline,
  waterOutline,
} from 'ionicons/icons';
import { blurAndRun } from '../utils/focus';
import {
  DAY_LABEL_FULL,
  type Comida,
  type DayKey,
  type MealKey,
} from '../templates/defaultUser';
import './MealSheet.css';

// Etiquetas locales (emoji + label corto) · DAY_LABEL_FULL importado
// arriba para usar la única fuente de verdad.
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // El día y la comida que se está mostrando · necesarios para el header
  // y para que el editor (Sub-fase 2B.3) sepa qué slot del menú está
  // editando cuando lo abramos desde aquí.
  day: DayKey;
  meal: MealKey;
  comida: Comida;
  // Acciones · placeholders hasta Sub-fase 2B.3 (editor) y 2B.4 (duplicar).
  onEdit?: () => void;
  onDuplicate?: () => void;
  // Eliminar la comida (vacía alimentos+macros). Solo se muestra si hay
  // contenido · vaciar una comida ya vacía no aporta nada.
  onDelete?: () => void;
}

// Bottom sheet con el detalle de una comida concreta. Se abre al pulsar
// una MealCard de MenuPage (o, en el futuro, las meal cards de HoyPage).
//
// Contenido:
//   - Header: emoji grande + meal name + día/hora + total kcal
//   - Lista de ingredientes (uno por línea)
//   - Bento grid 2×2 con macros (kcal · prot · carb · fat)
//   - Botones: Duplicar (placeholder) · Editar (abrirá editor en 2B.3)
//
// Si la comida está vacía (sin alimentos), muestra empty state + un único
// botón "Añadir comida" que abrirá el editor en blanco.
export function MealSheet({
  isOpen,
  onClose,
  day,
  meal,
  comida,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const isEmpty = comida.alimentos.length === 0;

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="meal-sheet"
      // Arranca al 85% de altura para que header + ingredientes + bento +
      // botones quepan sin que el user tenga que arrastrar el sheet. El
      // breakpoint 1 permite expandir a casi pantalla completa si la
      // comida tiene muchos ingredientes; el 0 cierra al arrastrar abajo.
      breakpoints={[0, 0.85, 1]}
      initialBreakpoint={0.85}
      handle
    >
      <IonContent>
        <div className="meal-sheet-content">
          {/* ── Header ── título uppercase + día/hora en sub.
               Las kcal viven solo en el bento de macros · evitamos
               duplicar info. */}
          <div className="meal-sheet-head">
            <div className="meal-sheet-emoji">
              {comida.emoji ?? MEAL_EMOJI[meal]}
            </div>
            <div className="meal-sheet-id">
              <h2>{MEAL_LABEL[meal].toUpperCase()}</h2>
              <p>
                {DAY_LABEL_FULL[day]}
                {comida.hora && ` · ${comida.hora}`}
              </p>
            </div>
            <button
              type="button"
              className="meal-sheet-close"
              onClick={blurAndRun(onClose)}
              aria-label="Cerrar"
            >
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          {/* Nombre del plato · prominente entre header e ingredientes.
              Solo se renderiza si hay nombre. Las 4 fijas pueden tener
              o no nombrePlato; los extras lo añaden además de su nombre
              propio (que va en el meta del header). */}
          {comida.nombrePlato && comida.nombrePlato.trim() !== '' && (
            <p className="meal-sheet-plato">{comida.nombrePlato.trim()}</p>
          )}

          {/* ── Empty state ── */}
          {isEmpty ? (
            <div className="meal-sheet-empty">
              <p>Aún no has añadido nada para {MEAL_LABEL[meal].toLowerCase()}.</p>
              {onEdit && (
                <IonButton
                  type="button"
                  expand="block"
                  className="meal-sheet-action-primary"
                  onClick={blurAndRun(onEdit)}
                >
                  <IonIcon icon={createOutline} slot="start" />
                  Añadir comida
                </IonButton>
              )}
            </div>
          ) : (
            <>
              {/* ── Lista de alimentos ── nombre + cantidad por línea */}
              <div className="meal-sheet-block">
                <h3>Ingredientes</h3>
                <ul className="meal-sheet-ingredients">
                  {comida.alimentos.map((al, i) => (
                    <li key={`${al.nombre}-${i}`}>
                      <span className="meal-sheet-ingrediente-nombre">{al.nombre}</span>
                      {al.cantidad && (
                        <span className="meal-sheet-ingrediente-cantidad">{al.cantidad}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Bento de macros ── icono+número arriba en línea
                   centrada, label "kcal/proteína/carbos/grasas" debajo
                   también centrada · readability uniforme. */}
              <div className="meal-sheet-block">
                <h3>Macros</h3>
                <div className="meal-sheet-bento">
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--kcal">
                    <span className="meal-sheet-bento-top">
                      <IonIcon icon={flameOutline} />
                      <span className="meal-sheet-bento-num">{comida.kcal}</span>
                    </span>
                    <span className="meal-sheet-bento-label">kcal</span>
                  </div>
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--prot">
                    <span className="meal-sheet-bento-top">
                      <IonIcon icon={barbellOutline} />
                      <span className="meal-sheet-bento-num">{comida.prot}g</span>
                    </span>
                    <span className="meal-sheet-bento-label">proteína</span>
                  </div>
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--carb">
                    <span className="meal-sheet-bento-top">
                      <IonIcon icon={leafOutline} />
                      <span className="meal-sheet-bento-num">{comida.carb}g</span>
                    </span>
                    <span className="meal-sheet-bento-label">carbos</span>
                  </div>
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--fat">
                    <span className="meal-sheet-bento-top">
                      <IonIcon icon={waterOutline} />
                      <span className="meal-sheet-bento-num">{comida.fat}g</span>
                    </span>
                    <span className="meal-sheet-bento-label">grasas</span>
                  </div>
                </div>
              </div>

              {/* ── Acciones · solo si hay alimentos ──
                   Layout: Eliminar (icono rojo) + Duplicar + Editar.
                   En móvil envolvemos a 2 filas via flex-wrap. */}
              <div className="meal-sheet-actions">
                {onDelete && (
                  <IonButton
                    type="button"
                    fill="outline"
                    className="meal-sheet-action-danger"
                    onClick={blurAndRun(onDelete)}
                    aria-label="Eliminar comida"
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                )}
                {onDuplicate && (
                  <IonButton
                    type="button"
                    fill="outline"
                    className="meal-sheet-action-secondary"
                    onClick={blurAndRun(onDuplicate)}
                  >
                    <IonIcon icon={copyOutline} slot="start" />
                    Duplicar
                  </IonButton>
                )}
                {onEdit && (
                  <IonButton
                    type="button"
                    className="meal-sheet-action-primary"
                    onClick={blurAndRun(onEdit)}
                  >
                    <IonIcon icon={createOutline} slot="start" />
                    Editar
                  </IonButton>
                )}
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
}
