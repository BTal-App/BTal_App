// Mapeo supermercado → su(s) MARCA(S) BLANCA(S). Espejo de SUPERMERCADO_BRANDS
// del frontend (src/templates/defaultUser.ts) · mantener en sync. Lo usan el
// prompt de la IA (proponer marca propia del súper) y searchFood (boost de
// ranking de productos de la marca del súper que elija el user).
export const SUPERMERCADO_BRANDS: Record<string, string[]> = {
  Mercadona: ['Hacendado'],
  Carrefour: ['Carrefour'],
  Lidl: ['Milbona', 'Sondey', 'Vitafit', 'Pilos'],
  Dia: ['Dia'],
  Consum: ['Consum'],
  Alcampo: ['Auchan', 'Alcampo'],
  Eroski: ['Eroski'],
  Aldi: ['Cucina Nobile', 'Cien'],
  'El Corte Inglés': ['Aliada', 'Hipercor'],
};

// Conjunto de marcas blancas (minúsculas) de los supermercados elegidos · para
// boost de ranking en searchFood.
export function brandsForSupermercados(supermercados: string[]): Set<string> {
  const out = new Set<string>();
  for (const s of supermercados) {
    for (const b of SUPERMERCADO_BRANDS[s] ?? []) out.add(b.toLowerCase());
  }
  return out;
}
