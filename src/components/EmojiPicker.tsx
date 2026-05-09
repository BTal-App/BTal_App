import { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { searchOutline, cloudOfflineOutline } from 'ionicons/icons';
import {
  GROUP_NAMES_ES,
  useEmojiData,
  type EmojiEntry,
} from '../hooks/useEmojiData';
import './EmojiPicker.css';

interface Props {
  // Emoji actualmente seleccionado · se resalta en el grid.
  selected: string | null;
  onSelect: (emoji: string) => void;
  // Botón para resetear al emoji default (sin emoji custom). Si no se
  // pasa, no aparece la opción.
  onReset?: () => void;
}

// Tabs visibles en el picker · cada uno corresponde a un grupo Unicode
// (ver GROUP_NAMES_ES). Orden de aparición: empezamos por Comida y
// Bebida porque es el caso más común en BTal · luego el resto del
// estándar Unicode. Cada tab muestra un emoji representativo (icono).
const TAB_DEFINITION: Array<{ group: number; icon: string; label: string }> = [
  { group: 4, icon: '🍎', label: 'Comida' },
  { group: 0, icon: '😀', label: 'Caras' },
  { group: 1, icon: '👋', label: 'Personas' },
  { group: 3, icon: '🐶', label: 'Animales' },
  { group: 5, icon: '✈', label: 'Viajes' },
  { group: 6, icon: '⚽', label: 'Activ.' },
  { group: 7, icon: '💡', label: 'Objetos' },
  { group: 8, icon: '❤', label: 'Símbolos' },
  { group: 9, icon: '🏁', label: 'Banderas' },
];

// Cuántos emojis renderizamos en el primer paint cuando NO hay query.
// Para listas de ~3500 emojis renderizar todo de golpe lagea. Mostramos
// los primeros N y revelamos el resto al hacer scroll cerca del final.
const INITIAL_RENDER = 200;
const RENDER_INCREMENT = 200;

// Normaliza string para búsqueda · elimina diacríticos (á→a, ñ→n) y
// pasa a lowercase. Hace que "platano" matchee "plátano" y viceversa.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function EmojiPicker({ selected, onSelect, onReset }: Props) {
  const { data, loading, error, isFallback } = useEmojiData();
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<number>(4); // arranca en Comida
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Cuando cambia query o tab, reseteamos el límite de render y volvemos
  // arriba del scroll. La regla eslint penaliza setState en useEffect,
  // pero aquí estamos sincronizando con un input externo (query del user)
  // + un side-effect DOM (scrollTop) · es exactamente para lo que sirve
  // useEffect. La alternativa state-from-props complicaría el código sin
  // ganar nada.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderLimit(INITIAL_RENDER);
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [query, activeGroup]);

  // Filtra la lista según query (global, todos los grupos) o tab.
  const filtered = useMemo<EmojiEntry[]>(() => {
    if (!data) return [];
    const q = normalize(query.trim());
    if (q) {
      // Búsqueda global: filtra por annotation + tags. Tokens AND.
      const tokens = q.split(/\s+/).filter(Boolean);
      return data.filter((e) => {
        const haystack = normalize(`${e.annotation} ${e.tags.join(' ')} ${e.emoji}`);
        return tokens.every((t) => haystack.includes(t));
      });
    }
    // Sin query: filtra por tab activa y ordena por `order` canónico.
    return data
      .filter((e) => e.group === activeGroup)
      .sort((a, b) => a.order - b.order);
  }, [data, query, activeGroup]);

  const visible = filtered.slice(0, renderLimit);

  const handleScroll = () => {
    if (!gridRef.current) return;
    const el = gridRef.current;
    // Cuando estamos a 200px del fondo, cargamos más.
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - 200
      && renderLimit < filtered.length
    ) {
      setRenderLimit((r) => Math.min(r + RENDER_INCREMENT, filtered.length));
    }
  };

  const groupLabel = query
    ? `Resultados (${filtered.length})`
    : (GROUP_NAMES_ES[activeGroup] ?? '');

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-search">
        <IonIcon icon={searchOutline} aria-hidden="true" />
        <input
          type="text"
          placeholder="Buscar (ej. plátano, fuego, sushi)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar emoji"
          maxLength={50}
        />
        {onReset && (
          <button
            type="button"
            className="emoji-picker-reset"
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              onReset();
            }}
          >
            Por defecto
          </button>
        )}
      </div>

      {/* Tabs de categorías · solo cuando NO hay query activa. Con query
          el filtro es global y los tabs perderían sentido. */}
      {!query && (
        <div className="emoji-picker-tabs" role="tablist">
          {TAB_DEFINITION.map((t) => (
            <button
              key={t.group}
              type="button"
              role="tab"
              aria-selected={activeGroup === t.group}
              aria-label={t.label}
              title={t.label}
              className={
                'emoji-picker-tab'
                + (activeGroup === t.group ? ' active' : '')
              }
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                setActiveGroup(t.group);
              }}
            >
              <span className="emoji-picker-tab-icon">{t.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Header pequeño con label de categoría / contador de búsqueda
          + warning si estamos en modo offline (fallback reducido). */}
      <div className="emoji-picker-meta">
        <span className="emoji-picker-meta-label">{groupLabel}</span>
        {isFallback && (
          <span className="emoji-picker-offline" title={error ?? ''}>
            <IonIcon icon={cloudOfflineOutline} />
            sin conexión
          </span>
        )}
      </div>

      <div
        className="emoji-picker-grid"
        role="listbox"
        aria-label="Emojis"
        ref={gridRef}
        onScroll={handleScroll}
      >
        {loading && !data ? (
          <div className="emoji-picker-loading">Cargando emojis…</div>
        ) : visible.length === 0 ? (
          <div className="emoji-picker-empty">
            {query
              ? `Sin resultados para "${query}"`
              : 'Sin emojis en esta categoría'}
          </div>
        ) : (
          visible.map((e) => (
            <button
              key={`${e.emoji}-${e.order}`}
              type="button"
              role="option"
              aria-selected={selected === e.emoji}
              aria-label={e.annotation}
              title={e.annotation}
              className={
                'emoji-picker-cell'
                + (selected === e.emoji ? ' active' : '')
              }
              onClick={(evt) => {
                (evt.currentTarget as HTMLElement).blur();
                onSelect(e.emoji);
              }}
            >
              {e.emoji}
            </button>
          ))
        )}
        {/* Indicador "más abajo" cuando aún no hemos rendered todo. */}
        {visible.length > 0 && visible.length < filtered.length && (
          <div className="emoji-picker-more">cargando más…</div>
        )}
      </div>
    </div>
  );
}
