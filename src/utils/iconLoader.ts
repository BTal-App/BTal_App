import type { ComponentType } from 'react';
import { getIconEntry } from './iconRegistry';

// ─────────────────────────────────────────────────────────────────────
// Icon Loader · lazy import del paquete `@tabler/icons-react` y cache.
//
// Reasoning:
// - El paquete completo pesa ~150 KB gzipped (con tree-shake al subset
//   curado del registry caen a ~30-50 KB). NO queremos meter eso en el
//   chunk principal · tree-shake reduce pero mete los iconos del
//   registry en index.js.
// - Usamos `import('@tabler/icons-react')` dinámico · Vite lo separa
//   en un chunk propio (ver vite.config.ts manualChunks).
// - El módulo se cachea en memoria a nivel de módulo · primera carga
//   ~150-200 ms en red rápida, todos los siguientes lookups son
//   síncronos.
//
// La API expuesta:
//   loadTablerModule()      → Promise<TablerModule>  (fuerza la carga · útil para prefetch)
//   loadTablerIcon(id)      → Promise<ComponentType> (resuelve un icono específico)
// ─────────────────────────────────────────────────────────────────────

// Tipo aproximado del módulo · cada export es un componente de icono
// con la firma `{ size?, stroke?, color?, className? }`. Lo modelamos
// como Record<string, any> para evitar acoplar el tipo concreto del
// paquete (los nombres son cientos).
type TablerIconComponent = ComponentType<{
  size?: number | string;
  stroke?: number | string;
  color?: string;
  className?: string;
  slot?: string;
  'aria-hidden'?: boolean;
  'aria-label'?: string;
}>;

type TablerModule = Record<string, TablerIconComponent>;

// Cache en memoria a nivel de módulo · sobrevive entre re-mounts.
let modulePromise: Promise<TablerModule> | null = null;

/**
 * Fuerza la carga (idempotente) del módulo Tabler. La promesa se cachea
 * para que sucesivas llamadas devuelvan el mismo módulo sin re-fetchar.
 *
 * Las llamadas concurrentes esperan a la misma promesa interna (no se
 * dispara un fetch por cada `<MealIcon />` que se renderice en paralelo
 * la primera vez).
 */
export function loadTablerModule(): Promise<TablerModule> {
  if (modulePromise === null) {
    // IMPORTANTE: importamos `./iconBarrel` (no `@tabler/icons-react`
    // directo) para que Vite tree-shake al subset curado · el barrel
    // hace re-export NAMED de los ~100 iconos del registry, y Vite ve
    // exactamente qué se usa. Sin el barrel, el dynamic import del
    // paquete entero produciría un chunk de ~500 KB gz (todos los
    // 6000+ iconos). Con el barrel · ~30-50 KB gz.
    //
    // Cast a través de `unknown` · el tipo real del módulo expone
    // ForwardRefExoticComponent específico de Tabler que TS no puede
    // reconciliar con nuestro TablerModule más laxo. La firma real de
    // los componentes acepta los props que pasamos.
    modulePromise = import('./iconBarrel') as unknown as Promise<TablerModule>;
  }
  return modulePromise;
}

/**
 * Resuelve un icono específico por su id `"tb:<slug>"`. Si el id no
 * existe en el registry · devuelve null. Si el `importName` del
 * registry no aparece en el módulo cargado · devuelve null (registry
 * desincronizado del paquete instalado, edge case).
 *
 * El caller decide qué hacer con `null`: `MealIcon` cae a su fallback
 * (otro id Tabler) o renderiza un placeholder vacío.
 */
export async function loadTablerIcon(
  id: string,
): Promise<TablerIconComponent | null> {
  const entry = getIconEntry(id);
  if (!entry) return null;
  const mod = await loadTablerModule();
  return mod[entry.importName] ?? null;
}

/**
 * Versión SYNC que solo funciona si el módulo ya está cargado.
 * `MealIcon` la usa después de Suspense · evita layout shift en
 * renders sucesivos del mismo icono.
 *
 * Devuelve null si el módulo aún no se cargó O el icono no existe.
 */
export function getTablerIconSync(
  id: string,
  loadedModule: TablerModule,
): TablerIconComponent | null {
  const entry = getIconEntry(id);
  if (!entry) return null;
  return loadedModule[entry.importName] ?? null;
}
