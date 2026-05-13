import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import {
  pushDiff,
  type ChangeEntry,
} from '../utils/confirmDiff';
import { blurAndRun } from '../utils/focus';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { SaveIndicator } from './SaveIndicator';
import { DeleteIndicator } from './DeleteIndicator';
import { MealIcon } from './MealIcon';
import {
  COMPRA_CATEGORIA_ICON_DEFAULT,
  newCompraItemId,
  type CategoriaCompra,
  type ItemCompra,
} from '../templates/defaultUser';
import './SettingsModal.css';
import './SupModal.css';
import './CompraItemEditorModal.css';

// Modal de añadir/editar un item de la lista de la compra.
// - mode='create' → crea nuevo item en `categoria.id` (id generado).
// - mode='edit' → edita el item existente · permite borrarlo desde
//   un botón "Quitar de la lista" + IonAlert de confirmación.
//
// El parser de precio acepta formatos comunes ("12,90", "12.90", "12") y
// ofrece un input pre-formateado al perder el foco. Cantidad es texto
// libre ("1 kg", "500 g", "1 docena") · el v1 lo gestionaba igual.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categoria: CategoriaCompra;
  // Si se pasa item, modo edit. Si no, modo create.
  item?: ItemCompra;
}

const NOMBRE_MAX = 60;
const CANTIDAD_MAX = 30;

export function CompraItemEditorModal({
  isOpen,
  onClose,
  categoria,
  item,
}: Props) {
  const isEdit = !!item;
  const {
    addCompraItem,
    updateCompraItem,
    removeCompraItem,
    restoreCompraItem,
  } = useProfile();

  const [nombre, setNombre] = useState(item?.nombre ?? '');
  const [cantidad, setCantidad] = useState(item?.cantidad ?? '');
  // Formatea siempre a 2 decimales · evita que un precio guardado como
  // 3.2 se muestre como "3,2" al reabrir (con `String(3.2)` el cero se
  // pierde). Usa coma como separador para coherencia con el placeholder
  // y la convención del usuario español.
  const formatPrecio = (n: number): string => n.toFixed(2).replace('.', ',');
  const [precioStr, setPrecioStr] = useState<string>(
    item?.precio !== undefined && item?.precio !== null
      ? formatPrecio(item.precio)
      : '',
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  // Diff antes/después · solo se muestra si es edit (hay item previo).
  // Si es create, persistimos directamente (no hay nada con qué comparar).
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: ItemCompra;
  } | null>(null);
  const [undoToast, setUndoToast] = useState<{
    item: ItemCompra;
    index: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer del cierre tras "Guardado ✓" · misma técnica que MealEditor.
  // Cancelamos al desmontar para evitar setState post-unmount.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  // Ciclo separado para delete · label "Eliminando… / Eliminado correctamente"
  // distinto del save genérico.
  const { status: deleteStatus, runSave: runDelete } = useSaveStatus();
  const submitting = saveStatus === 'saving';

  // Cuando el modal se vuelve a abrir, sincronizamos el form con el
  // item actual (puede haber cambiado externamente entre aperturas).
  const resetState = () => {
    setNombre(item?.nombre ?? '');
    setCantidad(item?.cantidad ?? '');
    setPrecioStr(
      item?.precio !== undefined && item?.precio !== null
        ? formatPrecio(item.precio)
        : '',
    );
    setConfirmDeleteOpen(false);
    setConfirmChanges(null);
    resetSave();
  };

  const parsePrecio = (str: string): number | null => {
    const trimmed = str.trim();
    if (!trimmed) return null;
    // Aceptamos coma o punto · convertimos coma → punto antes de parseFloat.
    const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
    const n = parseFloat(normalized);
    if (!Number.isFinite(n) || n < 0) return null;
    // Cap razonable + 2 decimales para evitar floats raros.
    return Math.min(99999.99, Math.round(n * 100) / 100);
  };

  // Sanitiza el texto del input de precio en cada onChange. Reglas:
  //  - Solo dígitos + un único separador decimal (coma o punto).
  //  - Sin signo negativo, sin "e" notación científica, sin espacios.
  //  - Máximo 2 decimales · trunca lo que venga después del segundo.
  // Devuelve el string limpio · si no queda nada útil, devuelve "".
  const sanitizePrecioInput = (raw: string): string => {
    let cleaned = raw.replace(/[^0-9.,]/g, '');
    // Solo el primer separador cuenta · normalizamos el resto a vacío.
    const firstSep = cleaned.search(/[.,]/);
    if (firstSep !== -1) {
      const head = cleaned.slice(0, firstSep);
      const sep = cleaned[firstSep];
      const tail = cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
      // Trunca a 2 decimales · evita estados con más precisión que
      // luego parsePrecio redondearía (mejor que el user vea el límite).
      cleaned = head + sep + tail.slice(0, 2);
    }
    return cleaned;
  };

  // Formatea precio para mostrar en el diff · "3,20 €" o "—" si null.
  const fmtPrecioDiff = (p: number | null): string =>
    p === null ? '—' : `${formatPrecio(p)} €`;

  const handleSave = () => {
    if (submitting) return;
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) return;
    const precioParsed = parsePrecio(precioStr);

    const cleaned: ItemCompra = isEdit && item
      ? {
          ...item,
          nombre: trimmedNombre,
          cantidad: cantidad.trim(),
          precio: precioParsed,
          source: 'user',
        }
      : {
          id: newCompraItemId(),
          nombre: trimmedNombre,
          cantidad: cantidad.trim(),
          comprado: false,
          precio: precioParsed,
          source: 'user',
        };

    // Diff sólo en modo edit · al crear, los 3 campos se muestran
    // como "— → valor" en el confirm.
    const changes: ChangeEntry[] = [];
    if (isEdit && item) {
      pushDiff(changes, 'Nombre', item.nombre, cleaned.nombre);
      pushDiff(changes, 'Cantidad', item.cantidad, cleaned.cantidad);
      pushDiff(
        changes,
        'Precio',
        fmtPrecioDiff(item.precio),
        fmtPrecioDiff(cleaned.precio),
      );
    } else {
      changes.push({ label: 'Nombre', from: '—', to: cleaned.nombre });
      if (cleaned.cantidad)
        changes.push({ label: 'Cantidad', from: '—', to: cleaned.cantidad });
      if (cleaned.precio !== null)
        changes.push({
          label: 'Precio',
          from: '—',
          to: fmtPrecioDiff(cleaned.precio),
        });
    }
    setConfirmChanges({ changes, cleaned });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges) return;
    const cleaned = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    let result;
    if (isEdit && item) {
      result = await runSave(() =>
        updateCompraItem(categoria.id, item.id, cleaned),
      );
    } else {
      result = await runSave(() => addCompraItem(categoria.id, cleaned));
    }
    if (result === SAVE_FAILED) return;
    // Espera a que el chip "Guardado ✓" sea visible antes de cerrar
    // (réplica del MealEditor · usa SAVED_INDICATOR_MS = 500ms).
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  const handleDelete = async () => {
    if (!item) return;
    setConfirmDeleteOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Ciclo dedicado al delete → chip "Eliminando… / Eliminado correctamente"
    // vía DeleteIndicator (semántica distinta del save).
    const result = await runDelete(() => removeCompraItem(categoria.id, item.id));
    if (result === SAVE_FAILED) return;
    // Esperar a que el chip sea visible antes de cerrar.
    closeTimer.current = setTimeout(() => {
      onClose();
      if (result) {
        // Toast con botón "Deshacer" 5s · réplica del v1.
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoToast(result);
        undoTimerRef.current = setTimeout(() => {
          setUndoToast(null);
        }, 5000);
      }
    }, SAVED_INDICATOR_MS);
  };

  const handleUndo = async () => {
    if (!undoToast) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const snap = undoToast;
    setUndoToast(null);
    try {
      await restoreCompraItem(categoria.id, snap.item, snap.index);
    } catch (err) {
      console.error('[BTal] restoreCompraItem error:', err);
    }
  };

  const canSave = nombre.trim().length > 0 && !submitting;

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card">
              {/* Botón X DENTRO del card · ver nota en BatidoInfoModal. */}
              <button
                type="button"
                className="settings-modal-close settings-modal-close--fixed"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  onClose();
                }}
                aria-label="Cerrar"
              >
                <MealIcon value="tb:x" size={22} />
              </button>
              <h2 className="settings-modal-title cat-editor-title">
                <MealIcon
                  value={categoria.emoji}
                  fallback={COMPRA_CATEGORIA_ICON_DEFAULT}
                  size={22}
                  className="cat-editor-title-icon"
                />
                {isEdit ? 'Editar producto' : 'Añadir producto'}
              </h2>
              <p className="settings-modal-text">
                Categoría: <strong>{categoria.nombre}</strong>
              </p>

              <div className="sup-form-group">
                <label className="sup-label">Nombre</label>
                <input
                  className="sup-input"
                  type="text"
                  maxLength={NOMBRE_MAX}
                  placeholder="Pechuga de pollo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoFocus={!isEdit}
                />
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Cantidad</label>
                <input
                  className="sup-input"
                  type="text"
                  maxLength={CANTIDAD_MAX}
                  placeholder="1 kg, 500 g, 1 docena…"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Precio (€)</label>
                <input
                  className="sup-input"
                  type="text"
                  inputMode="decimal"
                  // Sanitización: aceptamos solo dígitos y un único separador
                  // decimal (coma o punto). Rechazamos signo negativo, letras,
                  // múltiples separadores, etc. en el momento de tipear · evita
                  // estados inválidos y feedback retroactivo en el blur.
                  // maxLength=9 cubre "99999,99" (cap del parser) + holgura.
                  maxLength={9}
                  placeholder="12,90"
                  value={precioStr}
                  onChange={(e) => setPrecioStr(sanitizePrecioInput(e.target.value))}
                  onBeforeInput={(e) => {
                    // Bloquea caracteres no permitidos antes incluso de que
                    // entren al value · más limpio que limpiar después con
                    // onChange (especialmente con teclados móviles que no
                    // siempre respetan inputMode="decimal").
                    const ev = e.nativeEvent as InputEvent;
                    const data = ev.data;
                    if (data && !/^[0-9.,]$/.test(data)) {
                      e.preventDefault();
                    }
                  }}
                />
              </div>

              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
                <DeleteIndicator status={deleteStatus} />
              </div>

              <div className="sup-actions">
                <IonButton
                  type="button"
                  fill="outline"
                  className="sup-action-cancel"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    onClose();
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </IonButton>
                <IonButton
                  type="button"
                  className="settings-modal-primary"
                  onClick={(e) => {
                    (e.currentTarget as HTMLElement).blur();
                    handleSave();
                  }}
                  disabled={!canSave}
                >
                  {isEdit ? 'Guardar cambios' : 'Añadir'}
                </IonButton>
              </div>

              {isEdit && (
                <>
                  <div className="sup-divider" aria-hidden="true" />
                  <button
                    type="button"
                    className="sup-day-btn sup-day-btn--remove"
                    onClick={blurAndRun(() => setConfirmDeleteOpen(true))}
                    disabled={submitting}
                  >
                    <MealIcon value="tb:trash" size={18} />
                    Quitar de la lista
                  </button>
                </>
              )}
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={confirmDeleteOpen}
        onDidDismiss={() => setConfirmDeleteOpen(false)}
        header="¿Quitar de la lista?"
        message={`Eliminaremos "${item?.nombre ?? ''}" de ${categoria.nombre.toLowerCase()}. Tendrás 5 segundos para deshacer.`}
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Quitar',
            role: 'destructive',
            handler: () => {
              handleDelete();
            },
          },
        ]}
      />

      <ConfirmDiffAlert
        pending={confirmChanges}
        onCancel={() => setConfirmChanges(null)}
        onConfirm={() => {
          persistConfirmed().catch((err) =>
            console.error('[BTal] persistConfirmed item:', err),
          );
        }}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message={isEdit ? 'Producto actualizado' : 'Producto añadido'}
        duration={1500}
        position="bottom"
        color="success"
      />

      <IonToast
        isOpen={undoToast !== null}
        onDidDismiss={() => setUndoToast(null)}
        message={
          undoToast
            ? `"${undoToast.item.nombre}" eliminado`
            : ''
        }
        duration={5000}
        position="bottom"
        color="medium"
        buttons={[
          {
            text: 'Deshacer',
            role: 'cancel',
            handler: () => {
              handleUndo().catch((err) =>
                console.error('[BTal] handleUndo error:', err),
              );
            },
          },
        ]}
      />
    </>
  );
}
