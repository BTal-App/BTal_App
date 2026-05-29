// Derivación de la lista de la compra a partir del menú generado.
//
// La compra NO la genera la IA (decisión de producto · roadmap) · se
// deriva agregando los alimentos del menú y clasificándolos en las
// categorías builtIn por palabras clave. Heurística simple v1 · los
// alimentos que no encajan caen en "despensa".
//
// PRESERVA: categorías custom del user + items con source='user'.
// REEMPLAZA: solo los items con source='ai'/'ai-estimated' de las
// categorías builtIn (los derivados de una generación anterior).

import type { Compra, ItemCompra, Menu, SourceTag } from './types.js';
import { DAY_KEYS, MEAL_KEYS } from './types.js';

// Palabras clave → id de categoría builtIn. Orden de prioridad: se
// evalúa de la más específica a la más genérica.
const CATEGORY_KEYWORDS: Array<{ cat: string; words: string[] }> = [
  {
    cat: 'proteinas',
    words: ['pollo', 'pavo', 'ternera', 'cerdo', 'lomo', 'solomillo', 'huevo', 'atun', 'salmon', 'merluza', 'bacalao', 'gambas', 'marisco', 'tofu', 'seitan', 'tempeh', 'lentejas', 'garbanzos', 'alubias', 'jamon', 'pechuga', 'filete', 'carne', 'pescado', 'sardina', 'caballa'],
  },
  {
    cat: 'lacteos',
    words: ['leche', 'yogur', 'yogurt', 'queso', 'kefir', 'cuajada', 'requeson', 'mantequilla', 'nata', 'skyr'],
  },
  {
    cat: 'frutas_verduras',
    words: ['manzana', 'platano', 'naranja', 'fresa', 'arandano', 'frutos rojos', 'pera', 'uva', 'kiwi', 'mango', 'pina', 'melon', 'sandia', 'tomate', 'lechuga', 'espinaca', 'brocoli', 'zanahoria', 'pepino', 'pimiento', 'cebolla', 'ajo', 'calabacin', 'berenjena', 'champinon', 'seta', 'verdura', 'ensalada', 'fruta', 'aguacate', 'judias verdes', 'guisantes', 'esparrago', 'coliflor', 'rucula', 'canonigos'],
  },
  {
    cat: 'hidratos',
    words: ['arroz', 'pasta', 'pan', 'avena', 'patata', 'boniato', 'quinoa', 'cuscus', 'tortita', 'cereal', 'macarrones', 'espagueti', 'fideos', 'harina', 'tostada', 'maiz', 'bulgur'],
  },
  {
    cat: 'grasas',
    words: ['aceite', 'oliva', 'almendra', 'nuez', 'nueces', 'anacardo', 'avellana', 'pistacho', 'cacahuete', 'crema de cacahuete', 'semillas', 'chia', 'lino', 'coco'],
  },
  {
    cat: 'suplementacion',
    words: ['proteina en polvo', 'whey', 'caseina', 'creatina', 'batido de proteina', 'suplemento', 'bcaa', 'glutamina'],
  },
];

// Quita acentos (diacríticos combinantes U+0300–U+036F) + minúsculas + trim.
const DIACRITICS = /[̀-ͯ]/g;
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '').trim();
}

function categorize(nombre: string): string {
  const n = normalize(nombre);
  for (const { cat, words } of CATEGORY_KEYWORDS) {
    for (const w of words) {
      if (n.includes(normalize(w))) return cat;
    }
  }
  return 'despensa'; // fallback
}

let idCounter = 0;
function newItemId(): string {
  idCounter += 1;
  return `item_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

// Recoge todos los alimentos del menú (4 comidas fijas × 7 días),
// deduplica por nombre normalizado y los clasifica.
function collectFoods(menu: Menu): Map<string, { nombre: string; cat: string }> {
  const map = new Map<string, { nombre: string; cat: string }>();
  for (const day of DAY_KEYS) {
    const comidasDia = menu[day];
    for (const meal of MEAL_KEYS) {
      const comida = comidasDia[meal];
      for (const a of comida.alimentos) {
        const key = normalize(a.nombre);
        if (!key || map.has(key)) continue;
        map.set(key, { nombre: a.nombre, cat: categorize(a.nombre) });
      }
    }
  }
  return map;
}

// Construye la compra actualizada: preserva items 'user' + categorías
// custom, y reemplaza los items derivados (source 'ai'/'ai-estimated')
// con los del menú nuevo.
export function deriveShoppingList(existing: Compra, menu: Menu, source: SourceTag): Compra {
  const foods = collectFoods(menu);

  // Agrupa por categoría los alimentos del menú nuevo.
  const byCat = new Map<string, ItemCompra[]>();
  for (const { nombre, cat } of foods.values()) {
    const list = byCat.get(cat) ?? [];
    list.push({
      id: newItemId(),
      nombre,
      cantidad: '',
      comprado: false,
      precio: null,
      source,
    });
    byCat.set(cat, list);
  }

  // Reconstruye items: por cada categoría existente, conserva los items
  // del user y añade los nuevos derivados del menú.
  const nextItems: Record<string, ItemCompra[]> = {};
  for (const cat of existing.categorias) {
    const prev = existing.items[cat.id] ?? [];
    const userItems = prev.filter((it) => it.source === 'user');
    const derived = byCat.get(cat.id) ?? [];
    nextItems[cat.id] = [...userItems, ...derived];
  }
  // Categorías que tienen items pero no entry (paranoia · no debería pasar).
  for (const [catId, list] of byCat.entries()) {
    if (!(catId in nextItems)) nextItems[catId] = list;
  }

  return { categorias: existing.categorias, items: nextItems };
}
