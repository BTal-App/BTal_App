import { useEffect, useState } from 'react';

// emojibase-data sirve un JSON con todos los emojis Unicode (~3700) ya
// localizados al idioma elegido. Para español: cada emoji tiene
// `annotation` (nombre traducido) y `tags` (palabras clave). Esto nos
// ahorra tener que mantener una lista hardcodeada o cruzar dos endpoints.
//
// Una sola request a jsdelivr · CDN con gzip → ~100 KB sobre la red
// (en disco quedan ~700 KB). Lazy: solo se descarga cuando el user abre
// el EmojiPicker por primera vez.
const EMOJI_DATA_URL =
  'https://cdn.jsdelivr.net/npm/emojibase-data/es/compact.json';

// Versión del cache · subir cuando cambie el formato esperado.
const CACHE_KEY = 'btal_emoji_data_v1';

// Formato de cada emoji devuelto por emojibase-data ES (compact).
// El compact-json es una versión simplificada del data.json normal,
// más ligera. La estructura real:
//   { annotation, emoji, group, order, shortcodes, tags, hexcode, ... }
export interface EmojiEntry {
  emoji: string; // el caracter unicode (puede tener múltiples codepoints)
  annotation: string; // nombre legible en español ("cara sonriente")
  tags: string[]; // palabras clave en español
  group: number; // 0..10 según el grupo Unicode (ver GROUP_NAMES_ES)
  order: number; // orden canónico para mostrar agrupado
}

// Nombres de los grupos Unicode CLDR en español. Los emojis se agrupan
// por estos códigos (campo `group` del JSON). Saltamos algunos grupos
// que no existen en data (componentes, etc.). Orden de aparición igual
// al estándar Unicode.
export const GROUP_NAMES_ES: Record<number, string> = {
  0: 'Caras y emociones',
  1: 'Personas y cuerpo',
  3: 'Animales y naturaleza',
  4: 'Comida y bebida',
  5: 'Viajes y lugares',
  6: 'Actividades',
  7: 'Objetos',
  8: 'Símbolos',
  9: 'Banderas',
};

// Cache en memoria a nivel de módulo · evita re-procesar si varios
// pickers se montan en la misma sesión. Solo se llena tras el primer
// fetch exitoso (o lectura de localStorage).
let memoryCache: EmojiEntry[] | null = null;

// Fallback minimal · 50 emojis útiles para comidas si la red está caída
// y no hay localStorage. Mantiene el editor funcional siempre.
const FALLBACK: EmojiEntry[] = [
  { emoji: '🍽', annotation: 'cubiertos con plato', tags: ['comida', 'plato'], group: 7, order: 1 },
  { emoji: '🍴', annotation: 'tenedor y cuchillo', tags: ['cubiertos'], group: 7, order: 2 },
  { emoji: '🥢', annotation: 'palillos', tags: ['asiático'], group: 4, order: 3 },
  { emoji: '🍎', annotation: 'manzana roja', tags: ['fruta', 'manzana'], group: 4, order: 10 },
  { emoji: '🍏', annotation: 'manzana verde', tags: ['fruta'], group: 4, order: 11 },
  { emoji: '🍌', annotation: 'plátano', tags: ['fruta', 'banana'], group: 4, order: 12 },
  { emoji: '🍊', annotation: 'mandarina', tags: ['fruta', 'naranja'], group: 4, order: 13 },
  { emoji: '🍓', annotation: 'fresa', tags: ['fruta'], group: 4, order: 14 },
  { emoji: '🥝', annotation: 'kiwi', tags: ['fruta'], group: 4, order: 15 },
  { emoji: '🍇', annotation: 'uvas', tags: ['fruta'], group: 4, order: 16 },
  { emoji: '🥑', annotation: 'aguacate', tags: ['fruta'], group: 4, order: 17 },
  { emoji: '🍅', annotation: 'tomate', tags: ['vegetal'], group: 4, order: 18 },
  { emoji: '🥦', annotation: 'brócoli', tags: ['vegetal'], group: 4, order: 19 },
  { emoji: '🥬', annotation: 'lechuga', tags: ['vegetal'], group: 4, order: 20 },
  { emoji: '🥒', annotation: 'pepino', tags: ['vegetal'], group: 4, order: 21 },
  { emoji: '🥕', annotation: 'zanahoria', tags: ['vegetal'], group: 4, order: 22 },
  { emoji: '🌽', annotation: 'mazorca de maíz', tags: ['maiz'], group: 4, order: 23 },
  { emoji: '🥔', annotation: 'patata', tags: ['papa'], group: 4, order: 24 },
  { emoji: '🍠', annotation: 'boniato', tags: ['batata'], group: 4, order: 25 },
  { emoji: '🥚', annotation: 'huevo', tags: ['proteína'], group: 4, order: 26 },
  { emoji: '🍳', annotation: 'huevo frito', tags: ['desayuno'], group: 4, order: 27 },
  { emoji: '🥩', annotation: 'filete', tags: ['carne', 'ternera'], group: 4, order: 28 },
  { emoji: '🍗', annotation: 'muslo de pollo', tags: ['carne', 'pollo'], group: 4, order: 29 },
  { emoji: '🐟', annotation: 'pescado', tags: ['pez'], group: 4, order: 30 },
  { emoji: '🦐', annotation: 'gamba', tags: ['marisco', 'langostino'], group: 4, order: 31 },
  { emoji: '🍞', annotation: 'pan', tags: ['tostada'], group: 4, order: 32 },
  { emoji: '🥖', annotation: 'baguette', tags: ['pan'], group: 4, order: 33 },
  { emoji: '🥯', annotation: 'rosquilla', tags: ['bagel'], group: 4, order: 34 },
  { emoji: '🥨', annotation: 'pretzel', tags: [], group: 4, order: 35 },
  { emoji: '🥞', annotation: 'tortitas', tags: ['pancakes'], group: 4, order: 36 },
  { emoji: '🧇', annotation: 'gofre', tags: ['waffle'], group: 4, order: 37 },
  { emoji: '🍚', annotation: 'arroz', tags: ['blanco'], group: 4, order: 38 },
  { emoji: '🍝', annotation: 'pasta', tags: ['espagueti'], group: 4, order: 39 },
  { emoji: '🍜', annotation: 'ramen', tags: ['fideos', 'sopa'], group: 4, order: 40 },
  { emoji: '🍲', annotation: 'estofado', tags: ['guiso'], group: 4, order: 41 },
  { emoji: '🥗', annotation: 'ensalada verde', tags: ['ensalada'], group: 4, order: 42 },
  { emoji: '🥙', annotation: 'pita', tags: ['kebab'], group: 4, order: 43 },
  { emoji: '🌮', annotation: 'taco', tags: [], group: 4, order: 44 },
  { emoji: '🍕', annotation: 'pizza', tags: [], group: 4, order: 45 },
  { emoji: '🍔', annotation: 'hamburguesa', tags: ['burger'], group: 4, order: 46 },
  { emoji: '🥛', annotation: 'leche', tags: ['vaso'], group: 4, order: 50 },
  { emoji: '🧀', annotation: 'queso', tags: [], group: 4, order: 51 },
  { emoji: '☕', annotation: 'café', tags: [], group: 4, order: 60 },
  { emoji: '🍵', annotation: 'té', tags: ['infusión'], group: 4, order: 61 },
  { emoji: '🥤', annotation: 'batido', tags: ['refresco'], group: 4, order: 62 },
  { emoji: '🍯', annotation: 'miel', tags: [], group: 4, order: 70 },
  { emoji: '🥄', annotation: 'cuchara', tags: ['creatina'], group: 7, order: 71 },
  { emoji: '💪', annotation: 'bíceps', tags: ['fuerza', 'músculo'], group: 1, order: 80 },
  { emoji: '🏋', annotation: 'levantamiento de pesas', tags: ['gimnasio'], group: 6, order: 81 },
  { emoji: '🔥', annotation: 'fuego', tags: ['caliente'], group: 8, order: 82 },
];

interface UseEmojiDataResult {
  data: EmojiEntry[] | null;
  loading: boolean;
  error: string | null;
  // Indica si la lista mostrada es el fallback offline · sirve para
  // mostrar un mensaje pequeño "Modo sin conexión" en el picker.
  isFallback: boolean;
}

// Hook que carga la lista completa de emojis con nombres en español.
// Estrategia:
//   1. Si memoryCache existe, devolver inmediatamente (no fetch).
//   2. Si localStorage tiene cache (CACHE_KEY), devolverlo y aún así
//      refrescar en background (revalidación silenciosa).
//   3. Sin cache, fetch a la CDN con timeout 10s.
//   4. Si todo falla, devolver FALLBACK con isFallback=true.
export function useEmojiData(): UseEmojiDataResult {
  const [data, setData] = useState<EmojiEntry[] | null>(memoryCache);
  const [loading, setLoading] = useState(memoryCache === null);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    // Si ya tenemos memoryCache, no hacemos nada.
    if (memoryCache) return;

    let cancelled = false;

    // Lectura sincrónica del localStorage para mostrar algo cuanto antes.
    // El setState aquí sincroniza con el sistema externo (localStorage),
    // patrón explícitamente permitido por React docs · ignoramos la regla
    // de "no setState en effect" en las líneas concretas que disparan.
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as EmojiEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCache = parsed;
          if (!cancelled) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setData(parsed);
            setLoading(false);
          }
        }
      }
    } catch {
      // localStorage corrupto · ignoramos y seguimos al fetch.
    }

    // Fetch a la CDN · siempre lo intentamos (revalidación) salvo que
    // ya estuviese en memoryCache desde otro hook concurrente.
    (async () => {
      try {
        const res = await fetch(EMOJI_DATA_URL, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = (await res.json()) as Array<{
          unicode?: string;
          emoji?: string;
          annotation: string;
          tags?: string[];
          group?: number;
          order?: number;
        }>;
        // emojibase compact · campo `unicode` contiene el caracter en
        // Unicode "natural" (sin variation selectors decorativos). Si
        // está, lo preferimos · si no, caemos a `emoji`.
        const list: EmojiEntry[] = raw
          .filter((r) => (r.unicode ?? r.emoji))
          .map((r) => ({
            emoji: (r.unicode ?? r.emoji) as string,
            annotation: r.annotation,
            tags: r.tags ?? [],
            group: r.group ?? 99,
            order: r.order ?? 0,
          }))
          // Filtramos componentes (group 2 = component, sin sentido en picker).
          .filter((e) => e.group !== 2);
        memoryCache = list;
        if (cancelled) return;
        setData(list);
        setLoading(false);
        setError(null);
        setIsFallback(false);
        // Guardamos en localStorage para próximas sesiones · puede
        // saltar si está lleno; tragamos la excepción.
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(list));
        } catch {
          // QuotaExceeded etc · no es crítico.
        }
      } catch (err) {
        console.warn('[BTal] emoji data fetch failed, using fallback:', err);
        if (cancelled) return;
        // Si NO teníamos cache local, mostramos fallback.
        if (!memoryCache) {
          memoryCache = FALLBACK;
          setData(FALLBACK);
          setIsFallback(true);
        }
        setLoading(false);
        setError('Sin conexión · lista reducida');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error, isFallback };
}
