import { createElement, useEffect, useState } from 'react';
import { loadTablerModule, getTablerIconSync } from '../utils/iconLoader';

// ─────────────────────────────────────────────────────────────────────
// MealIcon · helper de render universal para los iconos del IconPicker.
//
// Reemplaza renders inline tipo `{comida.emoji ?? MEAL_EMOJI[meal]}`
// que existían en HoyPage / MenuPage / MealSheet / CompraPage tras
// migrar el EmojiPicker a IconPicker (Tabler).
//
// Comportamiento:
//   value: id Tabler "tb:..." (preferido) | null | undefined
//   fallback: id Tabler que se usa cuando value no resuelve
//
// Si ni `value` ni `fallback` resuelven a un icono del registry,
// renderiza un placeholder vacío del tamaño solicitado (mantiene
// el layout sin shift).
//
// Lazy loading:
// - Al primer mount, dispara `loadTablerModule()` · el paquete entero
//   se carga UNA vez y queda cacheado.
// - Mientras el módulo carga, renderiza un placeholder del mismo tamaño
//   (no hay layout shift).
// - Una vez cargado, el `<svg>` Tabler aparece · todas las instancias
//   subsiguientes se renderizan síncronas.
// ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Id Tabler `"tb:apple"` o null/undefined si no hay valor custom. */
  value: string | null | undefined;
  /** Id Tabler de fallback si `value` no resuelve. */
  fallback?: string;
  /** Tamaño en px (width = height). Default 24. */
  size?: number;
  /** Stroke width Tabler. Default 1.5 (match Ionicons outline). */
  stroke?: number;
  className?: string;
  /** Color CSS. Default `currentColor` (hereda del padre). */
  color?: string;
  /** aria-label opcional · si no se pasa, el icono es decorativo. */
  ariaLabel?: string;
  /** Slot · drop-in para `<IonButton slot="start"|"end"|"icon-only">`. */
  slot?: 'start' | 'end' | 'icon-only';
}

// Tipado del módulo Tabler · igual que en iconLoader (no acoplamos el tipo concreto).
import type { ComponentType } from 'react';
type TablerModule = Record<string, ComponentType<{
  size?: number | string;
  stroke?: number | string;
  color?: string;
  className?: string;
  slot?: string;
  'aria-hidden'?: boolean;
  'aria-label'?: string;
}>>;

// Cache compartido a nivel de módulo · una vez que el primer `<MealIcon>`
// resuelve la carga, el resto se beneficia sin re-disparar el import.
let cachedModule: TablerModule | null = null;

export function MealIcon({
  value,
  fallback,
  size = 24,
  stroke = 1.5,
  className,
  color = 'currentColor',
  ariaLabel,
  slot,
}: Props) {
  // Resolver finalId: prioridad value > fallback > null.
  const finalId =
    value && value.startsWith('tb:')
      ? value
      : fallback ?? null;

  // Estado del módulo · null mientras carga.
  const [mod, setMod] = useState<TablerModule | null>(cachedModule);

  useEffect(() => {
    if (cachedModule || mod) return;
    let mounted = true;
    loadTablerModule()
      .then((m) => {
        cachedModule = m;
        if (mounted) setMod(m);
      })
      .catch((err) => {
        console.warn('[MealIcon] Failed to load Tabler module', err);
      });
    return () => {
      mounted = false;
    };
  }, [mod]);

  // Si no hay finalId · placeholder vacío del tamaño (sin layout shift).
  if (!finalId) {
    return (
      <span
        className={className}
        slot={slot}
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size,
          height: size,
        }}
      />
    );
  }

  // Mientras el módulo carga · placeholder neutral (igual estructura).
  if (!mod) {
    return (
      <span
        className={className}
        slot={slot}
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size,
          height: size,
        }}
      />
    );
  }

  // Resolver el componente · si no existe en el módulo (registry
  // desincronizado del paquete) · null → placeholder.
  const Comp = getTablerIconSync(finalId, mod);
  if (!Comp) {
    return (
      <span
        className={className}
        slot={slot}
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size,
          height: size,
        }}
      />
    );
  }

  // Usamos `createElement` en lugar de JSX inline para sortear la
  // regla `react-hooks/static-components` · el componente Tabler se
  // resuelve dinámicamente desde el módulo cargado (no es un import
  // estático), pero su identidad es estable para cada `finalId`
  // gracias al cache del módulo, así que React no le ve "remount".
  return createElement(Comp, {
    size,
    stroke,
    color,
    className,
    slot,
    'aria-hidden': ariaLabel ? undefined : true,
    'aria-label': ariaLabel,
  });
}
