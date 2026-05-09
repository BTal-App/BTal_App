import { useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonContent,
  IonIcon,
  IonPage,
  IonToast,
} from '@ionic/react';
import {
  addOutline,
  closeOutline,
  flaskOutline,
  pencilOutline,
  refreshOutline,
  searchOutline,
  shareSocialOutline,
} from 'ionicons/icons';
import { TabHeader } from '../../components/TabHeader';
import { AppAvatarButton } from '../../components/AppAvatarButton';
import { EditSupStockModal } from '../../components/EditSupStockModal';
import { SupAlertBox } from '../../components/SupAlertBox';
import { CompraItemEditorModal } from '../../components/CompraItemEditorModal';
import { CompraCategoriaEditorModal } from '../../components/CompraCategoriaEditorModal';
import { useProfile } from '../../hooks/useProfile';
import {
  calcBatidoStats,
  calcCreatinaStats,
  defaultCompra,
  type CategoriaCompra,
  type Compra,
  type ItemCompra,
} from '../../templates/defaultUser';
import { computeSupAlerts, type SupAlert } from '../../utils/supAlerts';
import { blurAndRun } from '../../utils/focus';
import { useScrollTopOnEnter } from '../../utils/useScrollTopOnEnter';
import './CompraPage.css';

// Tab Compra · Sub-fase 2C · render completo de la lista de la compra:
// - Bloque SUPLEMENTACIÓN especial (precio botes + tracker + coste).
// - Categorías personalizables con items checkable (✓ comprado).
// - Toolbar: buscar, reset checks, compartir, nueva categoría.
// - CRUD de items (modal CompraItemEditorModal).
// - CRUD de categorías custom (modal CompraCategoriaEditorModal).
// - Total semanal (suma de precios sin suplementos · ya tienen su card).
const CompraPage: React.FC = () => {
  const { profile: userDoc, resetCompraChecks } = useProfile();
  const sup = userDoc?.suplementos;
  // La compra puede ser undefined en docs muy viejos · defaultCompra
  // como fallback para no romper el render.
  const compra: Compra = userDoc?.compra ?? defaultCompra();

  const [editingSup, setEditingSup] = useState<'batido' | 'creatina' | null>(
    null,
  );

  // Estado de modales y toasts.
  const [itemModal, setItemModal] = useState<
    | { mode: 'create'; categoria: CategoriaCompra }
    | { mode: 'edit'; categoria: CategoriaCompra; item: ItemCompra }
    | null
  >(null);
  const [categoriaModal, setCategoriaModal] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; categoria: CategoriaCompra }
    | null
  >(null);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmShareOpen, setConfirmShareOpen] = useState(false);
  // Alerts informativos (botón "Cerrar" único) · réplica del v1 con
  // títulos "Carrito vacío" / "Lista vacía". Se muestran cuando la
  // acción no tiene sentido (no hay nada que reiniciar / compartir).
  const [infoAlert, setInfoAlert] = useState<{
    header: string;
    message: string;
  } | null>(null);
  const [resetToast, setResetToast] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Buscador · filtro real-time sobre nombre del producto.
  const [query, setQuery] = useState('');
  const queryNorm = useMemo(() => query.trim().toLowerCase(), [query]);

  // Reset del scroll al top al volver a la tab Compra.
  const contentRef = useRef<HTMLIonContentElement>(null);
  useScrollTopOnEnter(contentRef);

  const batidoStats = sup ? calcBatidoStats(sup) : null;
  const creatinaStats = sup ? calcCreatinaStats(sup) : null;
  const alerts = sup ? computeSupAlerts(sup) : null;

  const batidoCostMes = sup ? estimarCosteMensual(sup, 'batido') : null;
  const creatinaCostMes = sup ? estimarCosteMensual(sup, 'creatina') : null;
  const totalMes =
    batidoCostMes !== null || creatinaCostMes !== null
      ? (batidoCostMes ?? 0) + (creatinaCostMes ?? 0)
      : null;
  const totalAnio = totalMes !== null ? totalMes * 12 : null;

  // Categorías ordenadas por `order` · evita renders alterados si el
  // doc trae el array en otro orden por race de Firestore.
  const categoriasOrdenadas = useMemo(
    () => [...compra.categorias].sort((a, b) => a.order - b.order),
    [compra.categorias],
  );

  // Cantidad total de items marcados como comprados (excluyendo la
  // categoría de suplementación, que no tiene tracker tipo checkbox).
  // Réplica del v1 (`getCompraChecksSet().size`). Si es 0 al pulsar
  // "Reiniciar" mostramos el aviso "Carrito vacío" en vez del confirm.
  const markedCount = useMemo(() => {
    let count = 0;
    for (const cat of compra.categorias) {
      if (cat.id === 'suplementacion') continue;
      const items = compra.items[cat.id] ?? [];
      count += items.filter((it) => it.comprado).length;
    }
    return count;
  }, [compra]);

  // Total semanal · suma de precios de items NO en categoría
  // suplementación (esa tiene su propio bloque arriba). Réplica del
  // v1 `recalcTotalSemanal`. Los items sin precio no suman.
  const totalSemanal = useMemo(() => {
    let total = 0;
    for (const cat of compra.categorias) {
      if (cat.id === 'suplementacion') continue;
      const items = compra.items[cat.id] ?? [];
      for (const item of items) {
        if (item.precio !== null && item.precio !== undefined) {
          total += item.precio;
        }
      }
    }
    return total;
  }, [compra]);

  // Disparado al pulsar el botón 🔄 "Reiniciar". v1 hace dos pasos:
  //   1. Si no hay nada marcado → aviso "Carrito vacío" (info-only).
  //   2. Si hay items marcados → confirm "Desmarcar todos los X..."
  // El reset real se ejecuta en `handleConfirmResetChecks` solo si el
  // user pulsa Reiniciar en el confirm.
  const handleResetButtonClick = () => {
    if (markedCount === 0) {
      setInfoAlert({
        header: 'Carrito vacío',
        message: 'No hay productos marcados como comprados.',
      });
      return;
    }
    setConfirmResetOpen(true);
  };

  const handleConfirmResetChecks = async () => {
    setConfirmResetOpen(false);
    try {
      await resetCompraChecks();
      setResetToast(true);
    } catch (err) {
      console.error('[BTal] resetCompraChecks error:', err);
    }
  };

  // Construye el texto plano de la lista para compartir · solo items
  // pendientes (no marcados). Réplica del v1 `buildCompraShareText`.
  // Devuelve string vacío si TODOS están comprados (caller muestra
  // entonces el aviso "Lista vacía").
  const buildShareText = (): string => {
    const lines: string[] = ['🛒 Lista de la compra · BTal\n'];
    let hasItems = false;
    for (const cat of categoriasOrdenadas) {
      const items = (compra.items[cat.id] ?? []).filter((it) => !it.comprado);
      if (items.length === 0) continue;
      hasItems = true;
      lines.push(`\n${cat.emoji} ${cat.nombre.toUpperCase()}`);
      for (const item of items) {
        const precio = item.precio !== null ? ` · ${fmtPrice(item.precio)}` : '';
        const cantidad = item.cantidad ? ` · ${item.cantidad}` : '';
        lines.push(`  • ${item.nombre}${cantidad}${precio}`);
      }
    }
    return hasItems ? lines.join('\n') : '';
  };

  // Disparado al pulsar 📤 "Compartir": abre el confirm con el aviso
  // explicativo del v1. El share real se ejecuta solo tras el "Continuar".
  const handleShareButtonClick = () => {
    setConfirmShareOpen(true);
  };

  const handleConfirmShare = async () => {
    setConfirmShareOpen(false);
    const text = buildShareText();
    if (!text) {
      setInfoAlert({
        header: 'Lista vacía',
        message:
          'Todos los productos están marcados como comprados. Desmarca los que aún necesites para compartir la lista.',
      });
      return;
    }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Lista de la compra', text });
        setShareToast('Lista compartida');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareToast('Lista copiada al portapapeles');
      } else {
        setShareToast('No se pudo compartir');
      }
    } catch (err) {
      // AbortError si el user cancela el share · silencioso.
      const e = err as { name?: string };
      if (e?.name === 'AbortError') return;
      console.error('[BTal] share compra error:', err);
      setShareToast('Error al compartir');
    }
  };

  return (
    <IonPage className="app-tab-page">
      <IonContent ref={contentRef} fullscreen>
        <div className="app-tab-content">
          <TabHeader
            title="Lista de "
            accent="compra"
            right={<AppAvatarButton />}
          />

          {/* ─── Toolbar superior ─── */}
          <div className="compra-toolbar">
            <div className="compra-search">
              <IonIcon icon={searchOutline} className="compra-search-icon" />
              <input
                type="text"
                className="compra-search-input"
                placeholder="Buscar producto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={60}
                aria-label="Buscar producto en la lista"
              />
              {query && (
                <button
                  type="button"
                  className="compra-search-clear"
                  onClick={blurAndRun(() => setQuery(''))}
                  aria-label="Limpiar búsqueda"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="compra-toolbar-btn"
              onClick={blurAndRun(handleResetButtonClick)}
              aria-label="Reiniciar marcas de comprado"
              title="Reiniciar carrito"
            >
              <IonIcon icon={refreshOutline} />
            </button>
            <button
              type="button"
              className="compra-toolbar-btn"
              onClick={blurAndRun(handleShareButtonClick)}
              aria-label="Compartir lista"
              title="Compartir lista"
            >
              <IonIcon icon={shareSocialOutline} />
            </button>
          </div>

          {/* ─── Categorías custom + builtIn (excluye suplementación,
                que tiene su bloque especial al final) ─── */}
          {categoriasOrdenadas
            .filter((c) => c.id !== 'suplementacion')
            .map((cat) => (
              <CategoriaCard
                key={cat.id}
                categoria={cat}
                items={compra.items[cat.id] ?? []}
                queryNorm={queryNorm}
                onAddItem={() =>
                  setItemModal({ mode: 'create', categoria: cat })
                }
                onEditItem={(item) =>
                  setItemModal({ mode: 'edit', categoria: cat, item })
                }
                onEditCategoria={() =>
                  setCategoriaModal({ mode: 'edit', categoria: cat })
                }
              />
            ))}

          {/* Botón "+ Nueva categoría" · al final del listado de
              categorías normales (antes del bloque de suplementación).
              Se oculta durante la búsqueda · esa acción no encaja con
              el contexto "estoy filtrando productos" y reduce el ruido
              visual del resultado. */}
          {!queryNorm && (
            <button
              type="button"
              className="compra-add-categoria-btn"
              onClick={blurAndRun(() => setCategoriaModal({ mode: 'create' }))}
            >
              <IonIcon icon={addOutline} />
              Nueva categoría
            </button>
          )}

          {/* ─── BLOQUE SUPLEMENTACIÓN · va siempre al final ───
               Réplica visual del v1: bloque especial separado del
               resto porque tiene su propia lógica de tracker en
               gramos y precio del bote (no es un item editable
               como los demás). El total semanal de arriba NO suma
               estos productos · van al "COSTE SUPLEMENTACIÓN" más
               abajo, calculado por dosis × frecuencia × precio/bote.
               Se oculta durante la búsqueda · el buscador es para
               filtrar productos de las categorías normales, los
               suples no aparecen como items individuales aquí. */}
          {!queryNorm && sup && batidoStats && creatinaStats && (
            <div className="compra-sup-card">
              <div className="compra-sup-cat-header">
                <h2>💪 SUPLEMENTACIÓN</h2>
              </div>
              <SupProductoRow
                defaultName="Proteína"
                nombre={sup.batidoConfig.producto_nombre}
                precio={sup.batidoConfig.producto_precio}
                stock={sup.batido_stock_gramos}
                consumidos={batidoStats.gramosConsumidos}
                restantesGramos={batidoStats.gramosRestantes}
                alert={alerts?.batidoProt ?? null}
                onEdit={() => setEditingSup('batido')}
              />
              <SupProductoRow
                defaultName="Creatina"
                nombre={sup.creatinaConfig.producto_nombre}
                precio={sup.creatinaConfig.producto_precio}
                stock={sup.creatina_stock_gramos}
                consumidos={creatinaStats.gramosConsumidos}
                restantesGramos={creatinaStats.gramosRestantes}
                alert={alerts?.creatina ?? null}
                onEdit={() => setEditingSup('creatina')}
              />
              <div className="compra-sup-badge-row">
                <span className="compra-sup-badge-label">
                  Batidos que puedes hacer:
                </span>
                <span
                  className={
                    'compra-sup-badge'
                    + ((batidoStats.posibles ?? 0) < 7
                      ? ' compra-sup-badge--warn'
                      : '')
                  }
                >
                  🥤{' '}
                  {batidoStats.posibles === null
                    ? '—'
                    : `${batidoStats.posibles} batido${
                        batidoStats.posibles === 1 ? '' : 's'
                      }`}
                </span>
              </div>
              <p className="compra-sup-note">
                Pulsa <strong>✏</strong> en cada producto para ajustar
                nombre, precio y los gramos del bote.
              </p>
            </div>
          )}

          {/* ─── Total semanal · suma SOLO categorías normales · NO
                cuenta los productos de suplementación (esos van a su
                propio "COSTE SUPLEMENTACIÓN" más abajo, calculado por
                consumo real, no por precio total del bote). Se oculta
                durante la búsqueda · el dato deja de tener sentido si
                el listado mostrado no es completo. ─── */}
          {!queryNorm && totalSemanal > 0 && (
            <div className="compra-total">
              <div className="compra-total-label-wrap">
                <span className="compra-total-label">Total semanal</span>
                <span className="compra-total-label-sub">
                  (sin suplementos)
                </span>
              </div>
              <span className="compra-total-amount">
                {fmtPrice(totalSemanal)}
              </span>
            </div>
          )}

          {/* ─── COSTE SUPLEMENTACIÓN · siempre al final ───
                Calculado por dosis × frecuencia × precio_bote (no por
                el precio del bote completo) · más justo: el bote dura
                varias semanas. Solo se muestra si hay datos. Se oculta
                durante la búsqueda · idem total semanal: contexto
                roto si el resto del listado está filtrado. */}
          {!queryNorm && totalMes !== null && totalMes > 0 && (
            <div className="compra-sup-cost">
              <div className="compra-sup-cost-label">
                Coste suplementación{' '}
                <span className="compra-sup-cost-label-sub">
                  (según gramos indicados)
                </span>
              </div>
              <div className="compra-sup-cost-grid">
                <div className="compra-sup-cost-cell compra-sup-cost-cell--mes">
                  <span className="compra-sup-cost-period">/ MES</span>
                  <span className="compra-sup-cost-amount">
                    {fmtPrice(totalMes)}
                  </span>
                </div>
                <div className="compra-sup-cost-cell compra-sup-cost-cell--anio">
                  <span className="compra-sup-cost-period">/ AÑO</span>
                  <span className="compra-sup-cost-amount">
                    {fmtPrice(totalAnio ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="app-tab-pad-bottom" />
        </div>

        {editingSup && (
          <EditSupStockModal
            isOpen={editingSup !== null}
            onClose={() => setEditingSup(null)}
            kind={editingSup}
          />
        )}

        {itemModal && (
          <CompraItemEditorModal
            isOpen={itemModal !== null}
            onClose={() => setItemModal(null)}
            categoria={itemModal.categoria}
            item={itemModal.mode === 'edit' ? itemModal.item : undefined}
          />
        )}

        {categoriaModal && (
          <CompraCategoriaEditorModal
            isOpen={categoriaModal !== null}
            onClose={() => setCategoriaModal(null)}
            categoria={
              categoriaModal.mode === 'edit'
                ? categoriaModal.categoria
                : undefined
            }
          />
        )}

        {/* Confirmación reset checks · réplica del v1: muestra cuántos
            items se van a desmarcar para que el user no se sorprenda. */}
        <IonAlert
          isOpen={confirmResetOpen}
          onDidDismiss={() => setConfirmResetOpen(false)}
          header="🔄 Reiniciar carrito"
          message={
            `¿Desmarcar todos los productos comprados? Se desmarcarán `
            + `${markedCount} producto${markedCount === 1 ? '' : 's'}. `
            + `Quedarán todos como pendientes de comprar.`
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Reiniciar',
              role: 'destructive',
              handler: () => {
                handleConfirmResetChecks();
              },
            },
          ]}
        />

        {/* Confirmación compartir lista · réplica del v1: explica QUÉ
            hace antes de ejecutar (genera texto solo con pendientes,
            usa Web Share API si existe, fallback portapapeles). */}
        <IonAlert
          isOpen={confirmShareOpen}
          onDidDismiss={() => setConfirmShareOpen(false)}
          header="📤 Compartir lista de compra"
          message={
            'Vamos a generar un texto con todos los productos pendientes '
            + 'de comprar (los NO marcados) agrupados por categoría, con '
            + 'precios. En el móvil intentará abrir el menú nativo de '
            + 'compartir (WhatsApp, Telegram, email…). Si no, lo copiará '
            + 'al portapapeles.'
          }
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Continuar',
              handler: () => {
                handleConfirmShare().catch((err) =>
                  console.error('[BTal] handleConfirmShare:', err),
                );
              },
            },
          ]}
        />

        {/* Aviso info-only · "Carrito vacío" / "Lista vacía" cuando la
            acción no aplica · réplica del `mobileInfo` del v1. */}
        <IonAlert
          isOpen={infoAlert !== null}
          onDidDismiss={() => setInfoAlert(null)}
          header={infoAlert?.header ?? ''}
          message={infoAlert?.message ?? ''}
          buttons={[{ text: 'Cerrar', role: 'cancel' }]}
        />

        <IonToast
          isOpen={resetToast}
          onDidDismiss={() => setResetToast(false)}
          message="Carrito reiniciado"
          duration={1800}
          position="bottom"
          color="success"
        />

        <IonToast
          isOpen={shareToast !== null}
          onDidDismiss={() => setShareToast(null)}
          message={shareToast ?? ''}
          duration={2000}
          position="bottom"
          color="medium"
        />
      </IonContent>
    </IonPage>
  );
};

export default CompraPage;

// ──────────────────────────────────────────────────────────────────────────
// Sub-componentes locales
// ──────────────────────────────────────────────────────────────────────────

interface CategoriaCardProps {
  categoria: CategoriaCompra;
  items: ItemCompra[];
  queryNorm: string;
  onAddItem: () => void;
  onEditItem: (item: ItemCompra) => void;
  onEditCategoria: () => void;
}

// Card de una categoría con su listado de items. Header con emoji +
// nombre + contador (X / Y comprados) + botón ⚙ para editar la
// categoría. Lista de items abajo + botón "+ Añadir producto" al
// final. Filtra por query si hay buscador activo.
function CategoriaCard({
  categoria,
  items,
  queryNorm,
  onAddItem,
  onEditItem,
  onEditCategoria,
}: CategoriaCardProps) {
  const { toggleCompraItemComprado } = useProfile();

  const filtered = useMemo(() => {
    if (!queryNorm) return items;
    return items.filter((it) =>
      it.nombre.toLowerCase().includes(queryNorm),
    );
  }, [items, queryNorm]);

  const totalCount = items.length;
  const boughtCount = items.filter((it) => it.comprado).length;
  const allBought = totalCount > 0 && boughtCount === totalCount;

  // Si hay query activa y la categoría no tiene matches, ocultamos
  // toda la card · evita ruido visual durante búsqueda.
  if (queryNorm && filtered.length === 0) return null;

  return (
    <div
      className={
        'compra-cat-card'
        + (allBought ? ' compra-cat-card--all-bought' : '')
      }
      style={{ '--compra-cat-color': categoria.color } as React.CSSProperties}
    >
      <div className="compra-cat-header">
        <span className="compra-cat-emoji" aria-hidden="true">
          {categoria.emoji}
        </span>
        <div className="compra-cat-id">
          <h3 className="compra-cat-name">{categoria.nombre}</h3>
          {/* Meta · contador "X / Y" + barra de progreso visual.
              Réplica del v1 (`updateCompraCardProgress`). La barra se
              llena conforme el user marca items como comprados, y al
              completar el 100% gana un glow lima · si añade nuevos
              productos el % baja automáticamente. */}
          {totalCount === 0 ? (
            <span className="compra-cat-count">sin productos</span>
          ) : (
            <div className="compra-cat-meta">
              <span
                className={
                  'compra-cat-count'
                  + (allBought ? ' compra-cat-count--complete' : '')
                }
              >
                <strong>{boughtCount}</strong> / {totalCount}
              </span>
              <div className="compra-cat-progress">
                <div
                  className={
                    'compra-cat-progress-fill'
                    + (allBought ? ' compra-cat-progress-fill--complete' : '')
                  }
                  style={{
                    width: `${Math.round((boughtCount / totalCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="compra-cat-edit-btn"
          onClick={blurAndRun(onEditCategoria)}
          aria-label={`Editar categoría ${categoria.nombre}`}
          title="Editar categoría"
        >
          <IonIcon icon={pencilOutline} />
        </button>
      </div>

      {filtered.length > 0 && (
        <ul className="compra-item-list">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={
                'compra-item'
                + (item.comprado ? ' compra-item--bought' : '')
              }
            >
              <button
                type="button"
                className="compra-item-check"
                onClick={blurAndRun(() => {
                  toggleCompraItemComprado(categoria.id, item.id).catch(
                    (err) =>
                      console.error('[BTal] toggleCompraItem:', err),
                  );
                })}
                aria-label={
                  item.comprado ? 'Desmarcar comprado' : 'Marcar comprado'
                }
                aria-pressed={item.comprado}
              >
                {item.comprado && '✓'}
              </button>
              <div className="compra-item-info">
                <span className="compra-item-name">{item.nombre}</span>
                {(item.cantidad || item.precio !== null) && (
                  <span className="compra-item-meta">
                    {item.cantidad}
                    {item.cantidad && item.precio !== null && ' · '}
                    {item.precio !== null && (
                      <span className="compra-item-precio">
                        {fmtPrice(item.precio)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="compra-item-edit"
                onClick={blurAndRun(() => onEditItem(item))}
                aria-label={`Editar ${item.nombre}`}
                title="Editar"
              >
                <IonIcon icon={pencilOutline} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="compra-add-item-btn"
        onClick={blurAndRun(onAddItem)}
      >
        <IonIcon icon={addOutline} />
        Añadir producto
      </button>
    </div>
  );
}

interface SupProductoRowProps {
  defaultName: string;
  nombre: string;
  precio: number | null;
  stock: number | null;
  consumidos: number | null;
  restantesGramos: number | null;
  alert: SupAlert | null;
  onEdit: () => void;
}

function SupProductoRow({
  defaultName,
  nombre,
  precio,
  stock,
  consumidos,
  restantesGramos,
  alert,
  onEdit,
}: SupProductoRowProps) {
  const displayName = nombre.trim() || defaultName;
  const noStock = stock === null;
  const cls = alert
    ? alert.level === 'danger'
      ? 'compra-sup-row--empty'
      : 'compra-sup-row--warn'
    : '';

  return (
    <div className={'compra-sup-row ' + cls}>
      <div className="compra-sup-row-head">
        <div className="compra-sup-row-id">
          <span className="compra-sup-row-name">{displayName}</span>
          <span className="compra-sup-row-price">
            {precio === null ? '—' : fmtPrice(precio)}
          </span>
        </div>
        <button
          type="button"
          className="compra-sup-row-edit"
          onClick={blurAndRun(onEdit)}
          aria-label={`Editar ${displayName}`}
        >
          <IonIcon icon={pencilOutline} />
        </button>
      </div>

      {noStock ? (
        <button
          type="button"
          className="compra-sup-row-empty-cta"
          onClick={blurAndRun(onEdit)}
        >
          <IonIcon icon={flaskOutline} />
          Introduce los gramos comprados
        </button>
      ) : (
        <>
          <div className="compra-sup-row-tracker">
            <span className="compra-sup-tracker-label">Consumido:</span>
            <span className="compra-sup-tracker-num">
              {consumidos ?? 0}
            </span>
            <span className="compra-sup-tracker-unit">g</span>
            <span
              className={
                'compra-sup-tracker-rem'
                + (cls ? ' compra-sup-tracker-rem--warn' : '')
              }
            >
              {restantesGramos ?? 0}g restantes
            </span>
          </div>
          {alert && <SupAlertBox alert={alert} />}
        </>
      )}
    </div>
  );
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

function estimarCosteMensual(
  sup: import('../../templates/defaultUser').Suplementos,
  kind: 'batido' | 'creatina',
): number | null {
  const stock =
    kind === 'batido' ? sup.batido_stock_gramos : sup.creatina_stock_gramos;
  const dosis =
    kind === 'batido' ? sup.batidoConfig.gr_prot : sup.creatinaConfig.gr_dose;
  const precio =
    kind === 'batido'
      ? sup.batidoConfig.producto_precio
      : sup.creatinaConfig.producto_precio;
  if (precio === null || stock === null || stock === 0 || dosis <= 0) {
    return null;
  }
  const dosisPorBote = stock / dosis;
  if (dosisPorBote <= 0) return null;
  const costePorDosis = precio / dosisPorBote;
  const diasSemana =
    kind === 'batido'
      ? sup.daysWithBatido.length
      : sup.daysWithCreatina.length;
  if (diasSemana === 0) return 0;
  const dosisMes = diasSemana * 4.33;
  return Math.round(costePorDosis * dosisMes * 100) / 100;
}

// Para que TS tipo el style con var custom en CSSProperties.
declare module 'react' {
  interface CSSProperties {
    '--compra-cat-color'?: string;
  }
}
