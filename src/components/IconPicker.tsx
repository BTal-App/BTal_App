import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ICON_REGISTRY,
  getIconsByCategory,
  searchIcons,
  type IconCategory,
  type IconEntry,
} from '../utils/iconRegistry';
import { loadTablerModule } from '../utils/iconLoader';
import { MealIcon } from './MealIcon';
import './IconPicker.css';

// ─────────────────────────────────────────────────────────────────────
// IconPicker · grid local de iconos Tabler con buscador.
//
// Reemplazo del antiguo `EmojiPicker` (Unicode) · ahora todos los
// iconos vienen de un registry curado de Tabler Icons (ver
// `utils/iconRegistry.ts`). Coherencia visual con el resto de la
// UI que usa Ionicons outline (Tabler tiene el mismo lenguaje).
//
// Diseñado para vivir DENTRO de un IonModal del padre (no es modal por
// sí mismo). Adapta altura al espacio disponible · el grid scrollea.
//
// API drop-in con EmojiPicker:
//   - selected: id Tabler "tb:..." | null
//   - onSelect: (id: string) => void   ← siempre emite formato Tabler
//   - onReset?: () => void             ← botón "Por defecto" opcional
// ─────────────────────────────────────────────────────────────────────

interface Props {
  selected: string | null;
  onSelect: (iconId: string) => void;
  onReset?: () => void;
}

// Tabs · cada categoría usa un icono Tabler representativo. El orden
// aquí define el orden visual en la barra de tabs. La 1ª (comida) es
// el default al abrir el picker. Con 8 tabs el row puede no caber en
// pantallas estrechas (<360px) · `.icon-picker-tabs` tiene
// `overflow-x: auto` para scroll horizontal cuando hace falta.
const TAB_DEFINITION: Array<{
  category: IconCategory;
  iconId: string;
  label: string;
}> = [
  { category: 'comida',     iconId: 'tb:apple',         label: 'Comida' },
  { category: 'bebidas',    iconId: 'tb:cup',           label: 'Bebidas' },
  { category: 'fitness',    iconId: 'tb:barbell',       label: 'Fitness' },
  { category: 'deportes',   iconId: 'tb:ball-football', label: 'Deportes' },
  { category: 'cocina',     iconId: 'tb:chef-hat',      label: 'Cocina' },
  { category: 'casa',       iconId: 'tb:home',          label: 'Casa' },
  { category: 'naturaleza', iconId: 'tb:leaf',          label: 'Natura' },
  { category: 'otros',      iconId: 'tb:dots',          label: 'Otros' },
];

// Cuántos iconos renderizamos por scroll-batch · el registry curado
// es ~140 entradas, así que un solo batch lo cubre todo. Mantenemos
// el patrón por si se amplía a 500+ en el futuro.
const INITIAL_RENDER = 250;
const RENDER_INCREMENT = 200;

export function IconPicker({ selected, onSelect, onReset }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<IconCategory>('comida');
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER);
  // Estado de carga del módulo Tabler · el grid se renderiza con
  // <MealIcon> que muestra placeholders mientras carga. Disparamos
  // la carga al montar el picker para que esté listo cuanto antes.
  const [moduleReady, setModuleReady] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Pre-warm: cargar el módulo Tabler al abrir el picker · garantiza
  // que el grid se ve sin placeholders rápidamente.
  useEffect(() => {
    let mounted = true;
    loadTablerModule()
      .then(() => {
        if (mounted) setModuleReady(true);
      })
      .catch((err) => {
        console.warn('[IconPicker] Failed to preload Tabler', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Reset del límite y scroll cuando cambia tab o query (igual que
  // el antiguo EmojiPicker).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setRenderLimit(INITIAL_RENDER);
    if (gridRef.current) gridRef.current.scrollTop = 0;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query, activeCategory]);

  // Filtra el registry según query (global) o tab (categoría).
  const filtered = useMemo<IconEntry[]>(() => {
    const q = query.trim();
    if (q) return searchIcons(q);
    return getIconsByCategory(activeCategory);
  }, [query, activeCategory]);

  const visible = filtered.slice(0, renderLimit);

  const handleScroll = () => {
    if (!gridRef.current) return;
    const el = gridRef.current;
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - 200
      && renderLimit < filtered.length
    ) {
      setRenderLimit((r) => Math.min(r + RENDER_INCREMENT, filtered.length));
    }
  };

  // Label de la sección · "Resultados (12)" si hay query, nombre de
  // tab si no.
  const groupLabel = query
    ? `Resultados (${filtered.length})`
    : TAB_DEFINITION.find((t) => t.category === activeCategory)?.label ?? '';

  return (
    <div className="icon-picker">
      <div className="icon-picker-search">
        <MealIcon value="tb:search" size={16} />
        <input
          type="text"
          placeholder="Buscar (ej. manzana, fuego, mancuerna)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar icono"
          maxLength={50}
        />
        {onReset && (
          <button
            type="button"
            className="icon-picker-reset"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              onReset();
            }}
          >
            Por defecto
          </button>
        )}
      </div>

      {/* Tabs · solo cuando NO hay query activa. Igual lógica que el
          EmojiPicker · con query el filtro es global y los tabs
          perderían sentido. */}
      {!query && (
        <div className="icon-picker-tabs" role="tablist">
          {TAB_DEFINITION.map((t) => (
            <button
              key={t.category}
              type="button"
              role="tab"
              aria-selected={activeCategory === t.category}
              aria-label={t.label}
              title={t.label}
              className={
                'icon-picker-tab'
                + (activeCategory === t.category ? ' active' : '')
              }
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                setActiveCategory(t.category);
              }}
            >
              <span className="icon-picker-tab-icon">
                <MealIcon value={t.iconId} size={20} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Header pequeño con label · sin warning offline porque ahora
          los iconos son locales (no CDN). */}
      <div className="icon-picker-meta">
        <span className="icon-picker-meta-label">{groupLabel}</span>
        <span className="icon-picker-meta-count">
          {ICON_REGISTRY.length} disponibles
        </span>
      </div>

      <div
        className="icon-picker-grid"
        role="listbox"
        aria-label="Iconos"
        ref={gridRef}
        onScroll={handleScroll}
      >
        {!moduleReady ? (
          <div className="icon-picker-loading">Cargando iconos…</div>
        ) : visible.length === 0 ? (
          <div className="icon-picker-empty">
            {query
              ? `Sin resultados para "${query}"`
              : 'Sin iconos en esta categoría'}
          </div>
        ) : (
          visible.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={selected === entry.id}
              aria-label={entry.tags_es[0] ?? entry.id}
              title={entry.tags_es[0] ?? entry.id}
              className={
                'icon-picker-cell'
                + (selected === entry.id ? ' active' : '')
              }
              onClick={(evt) => {
                (evt.currentTarget as HTMLElement).blur();
                onSelect(entry.id);
              }}
            >
              <MealIcon value={entry.id} size={22} />
            </button>
          ))
        )}
        {visible.length > 0 && visible.length < filtered.length && (
          <div className="icon-picker-more">cargando más…</div>
        )}
      </div>
    </div>
  );
}
