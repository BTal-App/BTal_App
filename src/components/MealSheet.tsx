import {
  IonButton,
  IonContent,
  IonModal,
} from '@ionic/react';
import { blurAndRun } from '../utils/focus';
import {
  DAY_LABEL_FULL,
  EXTRA_ICON_DEFAULT,
  MEAL_ICON_DEFAULT,
  type Comida,
  type ComidaExtra,
  type DayKey,
  type MealKey,
} from '../templates/defaultUser';
import { MealIcon } from './MealIcon';
import './MealSheet.css';

// Etiquetas de las 4 comidas fijas (label) · iconos default viven en
// `MEAL_ICON_DEFAULT` (templates/defaultUser.ts) · se aplican vía
// `<MealIcon>` cuando `comida.emoji` es null.
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
  // y para que el editor sepa qué slot/extra del menú está editando.
  day: DayKey;
  // Para las 4 fijas pasa la MealKey · para extras o usos genéricos
  // omítela y usa `title` + `iconFallback` directamente.
  meal?: MealKey;
  // El sheet sirve tanto para `Comida` (fija) como para `ComidaExtra`
  // (custom · añadida desde "Añadir comida"). Como `ComidaExtra extends
  // Comida` el tipo Comida cubre ambos casos en el render.
  comida: Comida | ComidaExtra;
  // Title/fallback override · si no se pasan, se derivan de `meal`.
  // Se usan para extras: title = `extra.nombre`, iconFallback =
  // EXTRA_ICON_DEFAULT. Mantienen el sheet 100% reutilizable.
  title?: string;
  iconFallback?: string;
  // Si true, debajo del título aparece un chip "EXTRA" para que el user
  // sepa que esa comida está marcada como extra (mismo distintivo que
  // ya tiene la card en el menú).
  isExtra?: boolean;
  // Acciones · todas opcionales; se renderizan solo si se pasan.
  onEdit?: () => void;
  onDuplicate?: () => void;
  // Eliminar la comida (vacía alimentos+macros · para fijas / borra el
  // extra entero · para extras). Solo se muestra si hay contenido.
  onDelete?: () => void;
  // Toggle "deshabilitar/habilitar" · solo aplica a extras. Si se pasa,
  // se renderiza un botón extra entre Duplicar y Editar que el caller
  // conecta a un confirm + provider. `isDisabled` decide el label
  // ("Deshabilitar" si está activa · "Habilitar" si está pausada).
  onToggleDisabled?: () => void;
  isDisabled?: boolean;
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
  title,
  iconFallback,
  isExtra,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleDisabled,
  isDisabled,
}: Props) {
  const isEmpty = comida.alimentos.length === 0;
  // Resolución de label e icon fallback · prioridad: override explícito
  // > derivado de `meal` (si es una fija) > placeholders genéricos.
  // Usamos `||` (no `??`) para que un `title=""` o `iconFallback=""` no
  // pase como "valor válido" y caiga al fallback genérico.
  const resolvedTitle =
    title || (meal ? MEAL_LABEL[meal] : 'Comida');
  const resolvedFallback =
    iconFallback || (meal ? MEAL_ICON_DEFAULT[meal] : EXTRA_ICON_DEFAULT);
  // Para el empty state del editor en blanco · "Añadir comida/extra/etc."
  // En extras no hay un MealKey · usamos la palabra "comida" en lugar
  // del nombre del meal (que en fijas sería "desayuno", "cena", etc.).
  const emptyLabel = meal ? MEAL_LABEL[meal].toLowerCase() : 'esta comida';

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
              <MealIcon
                value={comida.emoji}
                fallback={resolvedFallback}
                size={32}
              />
            </div>
            <div className="meal-sheet-id">
              <h2>
                {resolvedTitle.toUpperCase()}
                {isExtra && (
                  <span className="meal-sheet-extra-tag" aria-hidden="true">
                    extra
                  </span>
                )}
              </h2>
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
              <MealIcon value="tb:x" size={22} />
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
              <p>Aún no has añadido nada para {emptyLabel}.</p>
              {onEdit && (
                <IonButton
                  type="button"
                  expand="block"
                  className="meal-sheet-action-primary"
                  onClick={blurAndRun(onEdit)}
                >
                  <MealIcon value="tb:edit" size={18} slot="start" />
                  Añadir comida
                </IonButton>
              )}
              {/* Toggle también disponible en empty state · cubre el
                  caso de un extra deshabilitado sin alimentos · si no,
                  no habría forma de rehabilitarlo sin editar. */}
              {onToggleDisabled && (
                <IonButton
                  type="button"
                  expand="block"
                  fill="outline"
                  className="meal-sheet-action-secondary"
                  onClick={blurAndRun(onToggleDisabled)}
                >
                  <MealIcon
                    value={isDisabled ? 'tb:eye' : 'tb:eye-off'}
                    size={18}
                    slot="start"
                  />
                  {isDisabled ? 'Habilitar' : 'Deshabilitar'}
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
                      <MealIcon value="tb:flame" size={20} />
                      <span className="meal-sheet-bento-num">{comida.kcal}</span>
                    </span>
                    <span className="meal-sheet-bento-label">kcal</span>
                  </div>
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--prot">
                    <span className="meal-sheet-bento-top">
                      <MealIcon value="tb:dumbbell" size={20} />
                      <span className="meal-sheet-bento-num">{comida.prot}g</span>
                    </span>
                    <span className="meal-sheet-bento-label">proteína</span>
                  </div>
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--carb">
                    <span className="meal-sheet-bento-top">
                      <MealIcon value="tb:leaf" size={20} />
                      <span className="meal-sheet-bento-num">{comida.carb}g</span>
                    </span>
                    <span className="meal-sheet-bento-label">carbos</span>
                  </div>
                  <div className="meal-sheet-bento-cell meal-sheet-bento-cell--fat">
                    <span className="meal-sheet-bento-top">
                      <MealIcon value="tb:droplet" size={20} />
                      <span className="meal-sheet-bento-num">{comida.fat}g</span>
                    </span>
                    <span className="meal-sheet-bento-label">grasas</span>
                  </div>
                </div>
              </div>

              {/* ── Acciones · solo si hay alimentos ──
                   Layout: Eliminar (icono rojo) + Duplicar +
                   [Deshabilitar/Habilitar · solo extras] + Editar.
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
                    <MealIcon value="tb:trash" size={20} slot="icon-only" />
                  </IonButton>
                )}
                {onDuplicate && (
                  <IonButton
                    type="button"
                    fill="outline"
                    className="meal-sheet-action-secondary"
                    onClick={blurAndRun(onDuplicate)}
                  >
                    <MealIcon value="tb:copy" size={18} slot="start" />
                    Duplicar
                  </IonButton>
                )}
                {onToggleDisabled && (
                  <IonButton
                    type="button"
                    fill="outline"
                    className="meal-sheet-action-secondary"
                    onClick={blurAndRun(onToggleDisabled)}
                    aria-label={
                      isDisabled
                        ? 'Habilitar comida · volverá a contar en el total'
                        : 'Deshabilitar comida · dejará de contar en el total'
                    }
                  >
                    <MealIcon
                      value={isDisabled ? 'tb:eye' : 'tb:eye-off'}
                      size={18}
                      slot="start"
                    />
                    {isDisabled ? 'Habilitar' : 'Deshabilitar'}
                  </IonButton>
                )}
                {onEdit && (
                  <IonButton
                    type="button"
                    className="meal-sheet-action-primary"
                    onClick={blurAndRun(onEdit)}
                  >
                    <MealIcon value="tb:edit" size={18} slot="start" />
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
