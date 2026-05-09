import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { useProfile } from '../hooks/useProfile';
import {
  SAVED_INDICATOR_MS,
  SAVE_FAILED,
  useSaveStatus,
} from '../hooks/useSaveStatus';
import { SaveIndicator } from './SaveIndicator';
import { pushDiff, type ChangeEntry } from '../utils/confirmDiff';
import { ConfirmDiffAlert } from './ConfirmDiffAlert';
import { blockNonInteger, clampInt } from '../utils/numericInput';
import './SettingsModal.css';
import './SupModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kind: 'batido' | 'creatina';
}

// Modal del PRODUCTO comprado · Sub-fase 2B.5.b. Solo edita los datos
// del bote: nombre del producto, precio y gramos. Esos valores son los
// que se ven en el bloque "💪 SUPLEMENTACIÓN" de la lista de la compra
// y los que alimentan el cálculo de "batidos posibles" / "dosis posibles".
//
// Los CONTADORES (counter ±1, esta semana, este mes, resets) viven en
// `EditSupCountersModal` accesible desde el modal info de Menú · más
// limpio y respeta la separación de responsabilidades pedida por el user:
// "los datos del producto van en COMPRA, los contadores en MENÚ".
//
// Solo se accede a este modal desde CompraPage (botón ✏ del producto).
export function EditSupStockModal({ isOpen, onClose, kind }: Props) {
  const {
    profile: userDoc,
    setSupStockGramos,
    setBatidoConfig,
    setCreatinaConfig,
  } = useProfile();
  const sup = userDoc?.suplementos;
  const current =
    kind === 'batido'
      ? sup?.batido_stock_gramos ?? null
      : sup?.creatina_stock_gramos ?? null;
  const dosisGramos =
    kind === 'batido'
      ? sup?.batidoConfig.gr_prot ?? 35
      : sup?.creatinaConfig.gr_dose ?? 3;
  const productoNombre =
    kind === 'batido'
      ? sup?.batidoConfig.producto_nombre ?? ''
      : sup?.creatinaConfig.producto_nombre ?? '';
  const productoPrecio =
    kind === 'batido'
      ? sup?.batidoConfig.producto_precio ?? null
      : sup?.creatinaConfig.producto_precio ?? null;

  const [stockInput, setStockInput] = useState<string>(
    current === null ? '' : String(current),
  );
  const [nombreInput, setNombreInput] = useState<string>(productoNombre);
  const [precioInput, setPrecioInput] = useState<string>(
    productoPrecio === null ? '' : String(productoPrecio),
  );
  const [savedToast, setSavedToast] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState<{
    changes: ChangeEntry[];
    cleaned: { newStock: number | null; newNombre: string; newPrecio: number | null };
  } | null>(null);
  const { status: saveStatus, runSave, reset: resetSave } = useSaveStatus();
  const submitting = saveStatus === 'saving';

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const resetState = () => {
    setStockInput(current === null ? '' : String(current));
    setNombreInput(productoNombre);
    setPrecioInput(productoPrecio === null ? '' : String(productoPrecio));
    setSavedToast(false);
    setConfirmChanges(null);
    resetSave();
  };

  // Parsea precio aceptando coma o punto decimal · 2 decimales.
  const parsePrecio = (s: string): number | null => {
    const trimmed = s.trim().replace(',', '.');
    if (trimmed === '') return null;
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(9999.99, Math.round(n * 100) / 100);
  };

  const fmtPrecio = (p: number | null): string =>
    p === null || p === undefined
      ? '—'
      : `${p.toFixed(2).replace('.', ',')} €`;

  // Guarda los 3 campos (nombre, precio, gramos) en una sola operación.
  const handleSaveAll = () => {
    if (submitting || !sup) return;
    const trimmed = stockInput.trim();
    const newStock: number | null =
      trimmed === '' ? null : clampInt(trimmed, 0, 99999);
    const newNombre = nombreInput.trim().slice(0, 60);
    const newPrecio = parsePrecio(precioInput);

    // Siempre es edit (los datos del producto ya existen).
    const changes: ChangeEntry[] = [];
    pushDiff(changes, 'Nombre', productoNombre, newNombre);
    pushDiff(
      changes,
      'Precio bote',
      fmtPrecio(productoPrecio),
      fmtPrecio(newPrecio),
    );
    pushDiff(changes, 'Stock (g)', current, newStock);
    setConfirmChanges({ changes, cleaned: { newStock, newNombre, newPrecio } });
  };

  const persistConfirmed = async () => {
    if (!confirmChanges || !sup) return;
    const { newStock, newNombre, newPrecio } = confirmChanges.cleaned;
    setConfirmChanges(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const result = await runSave(async () => {
      if (kind === 'batido') {
        const next = {
          ...sup.batidoConfig,
          producto_nombre: newNombre,
          producto_precio: newPrecio,
        };
        await setBatidoConfig(next);
      } else {
        const next = {
          ...sup.creatinaConfig,
          producto_nombre: newNombre,
          producto_precio: newPrecio,
        };
        await setCreatinaConfig(next);
      }
      await setSupStockGramos(kind, newStock);
    });
    if (result === SAVE_FAILED) return;
    closeTimer.current = setTimeout(() => {
      setSavedToast(true);
      onClose();
    }, SAVED_INDICATOR_MS);
  };

  // Preview de dosis posibles según los gramos del input actual.
  const stockTrimmed = stockInput.trim();
  const stockNum =
    stockTrimmed === '' ? null : clampInt(stockTrimmed, 0, 99999);
  const dosisPreview =
    stockNum === null || dosisGramos <= 0
      ? null
      : Math.floor(stockNum / dosisGramos);

  const titleCls =
    kind === 'batido' ? 'sup-title-batido' : 'sup-title-creatina';
  const titleTxt =
    kind === 'batido' ? '🥤 PRODUCTO · BATIDO' : '🥄 PRODUCTO · CREATINA';

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onWillPresent={resetState}
        onDidDismiss={onClose}
        className="settings-modal"
      >
        <button
          type="button"
          className="settings-modal-close settings-modal-close--fixed"
          onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            onClose();
          }}
          aria-label="Cerrar"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <IonContent>
          <div className="settings-modal-bg">
            <div className="settings-modal-card">
              <h2 className={'settings-modal-title ' + titleCls}>
                {titleTxt}
              </h2>
              <p className="settings-modal-text">
                Datos del bote comprado · alimentan el bloque de
                suplementación de la lista de la compra y el cálculo de
                cuántos {kind === 'batido' ? 'batidos' : 'dosis'} puedes
                hacer. Para ver/editar contadores, ve a{' '}
                <strong>Menú → {kind === 'batido' ? '🥤 BATIDO' : '🥄 CREATINA'} → 📊 Stock y contadores</strong>.
              </p>

              <div className="sup-form-group">
                <label className="sup-label">Nombre del producto</label>
                <input
                  className="sup-input"
                  type="text"
                  maxLength={60}
                  placeholder={
                    kind === 'batido'
                      ? 'ej. "Whey Iso 100"'
                      : 'ej. "Creatina Monohidrato"'
                  }
                  value={nombreInput}
                  onChange={(e) => setNombreInput(e.target.value)}
                />
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Precio del bote (€)</label>
                <div className="sup-input-suffix">
                  <input
                    className="sup-input"
                    type="text"
                    inputMode="decimal"
                    maxLength={8}
                    placeholder="(no definido)"
                    value={precioInput}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(
                        /[^0-9.,]/g,
                        '',
                      );
                      setPrecioInput(cleaned);
                    }}
                  />
                  <span>€</span>
                </div>
              </div>

              <div className="sup-form-group">
                <label className="sup-label">Gramos en el bote</label>
                <div className="sup-input-suffix">
                  <input
                    className="sup-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99999}
                    step={1}
                    maxLength={5}
                    placeholder="(no definido)"
                    value={stockInput}
                    onKeyDown={blockNonInteger}
                    onChange={(e) => setStockInput(e.target.value)}
                  />
                  <span>g</span>
                </div>
                {dosisPreview !== null && (
                  <span className="sup-input-preview">
                    = {dosisPreview}{' '}
                    {kind === 'batido'
                      ? dosisPreview === 1
                        ? 'batido posible'
                        : 'batidos posibles'
                      : dosisPreview === 1
                      ? 'dosis posible'
                      : 'dosis posibles'}
                    {' · '}
                    {dosisGramos}g por{' '}
                    {kind === 'batido' ? 'batido' : 'dosis'}
                  </span>
                )}
              </div>

              <div className="save-indicator-wrap">
                <SaveIndicator status={saveStatus} />
              </div>

              <IonButton
                type="button"
                expand="block"
                className="settings-modal-primary"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement).blur();
                  handleSaveAll();
                }}
                disabled={submitting}
              >
                <IonIcon icon={saveOutline} slot="start" />
                Guardar
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
            console.error('[BTal] persistConfirmed sup stock:', err),
          );
        }}
      />

      <IonToast
        isOpen={savedToast}
        onDidDismiss={() => setSavedToast(false)}
        message="Producto actualizado"
        duration={2000}
        position="bottom"
        color="success"
      />
    </>
  );
}
