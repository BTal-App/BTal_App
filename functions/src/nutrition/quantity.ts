// Parser de la `cantidad` (string libre de la IA) → gramos estimados.
//
// La IA escribe cantidades muy variadas: "60 g", "250 ml", "1 plátano",
// "2 huevos", "1 cucharada de aceite", "1 lata (140 g escurrido)", "al gusto".
// Devolvemos gramos (best-effort) + si la cantidad es ESCALABLE (peso/volumen
// que se puede subir/bajar a decimales sin quedar raro) o no (unidades
// discretas: 1,5 huevos queda mal · esas no se escalan al ajustar el menú).
//
// Si no se puede determinar (sin número, sin unidad conocida, "al gusto") →
// grams=null · el resolver caerá en la macro estimada por la IA para ese item.

export interface ParsedQuantity {
  grams: number | null;
  scalable: boolean;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Peso/volumen → gramos (≈1 g/ml). ESCALABLES.
const WEIGHT_TO_G: Record<string, number> = {
  g: 1, gr: 1, grs: 1, gramo: 1, gramos: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, kilogramos: 1000,
  mg: 0.001,
  ml: 1, mililitro: 1, mililitros: 1, cc: 1,
  l: 1000, litro: 1000, litros: 1000, cl: 10, dl: 100,
};

// Unidades discretas (porciones, contenedores y alimentos contables) → gramos
// por pieza. NO escalables (se ajustan a entero, no a 1,37 huevos).
const DISCRETE_TO_G: Record<string, number> = {
  // porciones / utensilios
  cucharada: 15, cucharadas: 15, cda: 15, cdas: 15, soperas: 15, sopera: 15,
  cucharadita: 5, cucharaditas: 5, cdta: 5, cdta_s: 5, cdtas: 5,
  vaso: 200, vasos: 200, taza: 240, tazas: 240, tacita: 120,
  chorrito: 10, chorro: 10, pizca: 1, punado: 30, punados: 30, punito: 20,
  loncha: 20, lonchas: 20, rebanada: 30, rebanadas: 30, rodaja: 20, rodajas: 20,
  lata: 120, latas: 120, bote: 200, sobre: 15, sobres: 15, tarrina: 100,
  // alimentos contables comunes (peso medio por pieza)
  huevo: 55, huevos: 55, clara: 33, claras: 33, yema: 17,
  platano: 120, platanos: 120, banana: 120, bananas: 120,
  manzana: 180, manzanas: 180, naranja: 180, naranjas: 180,
  mandarina: 70, mandarinas: 70, kiwi: 75, kiwis: 75, pera: 170, peras: 170,
  melocoton: 150, durazno: 150, fresa: 12, fresas: 12,
  patata: 150, patatas: 150, boniato: 150, batata: 150,
  zanahoria: 80, zanahorias: 80, tomate: 120, tomates: 120,
  cebolla: 150, cebollas: 150, pimiento: 150, pimientos: 150,
  calabacin: 200, pepino: 300, aguacate: 200, aguacates: 200, diente: 5,
  filete: 125, filetes: 125, pechuga: 150, pechugas: 150,
  salchicha: 40, salchichas: 40, hamburguesa: 120, hamburguesas: 120,
  yogur: 125, yogures: 125, tortita: 10, tortitas: 10, galleta: 8, galletas: 8,
  nuez: 5, nueces: 5, datil: 8, datiles: 8,
};

export function parseQuantity(raw: string): ParsedQuantity {
  if (!raw) return { grams: null, scalable: false };
  let s = stripAccents(String(raw).toLowerCase()).trim();
  if (!s) return { grams: null, scalable: false };

  // Fracciones unicode + "medio/media".
  s = s
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/¾/g, ' 0.75 ')
    .replace(/⅓/g, ' 0.33 ')
    .replace(/⅔/g, ' 0.66 ')
    .replace(/\bmedi[oa]\b/g, ' 0.5 ');
  // Coma decimal → punto.
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  // Separa número pegado a la unidad ("60g" → "60 g").
  s = s.replace(/(\d)([a-z])/g, '$1 $2');
  // Deja solo letras, dígitos, punto y barra (fracciones a/b).
  s = s.replace(/[^a-z0-9./ ]/g, ' ').replace(/\s+/g, ' ').trim();

  const tokens = s.split(' ').filter(Boolean);

  // Número que precede a la posición i (o 1 si no hay). Soporta fracción "a/b".
  const numBefore = (i: number): number => {
    for (let j = i - 1; j >= 0; j--) {
      const f = tokens[j].match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
      if (f) {
        const v = parseFloat(f[1]) / parseFloat(f[2]);
        return isFinite(v) && v > 0 ? v : 1;
      }
      if (/^\d+(?:\.\d+)?$/.test(tokens[j])) {
        const v = parseFloat(tokens[j]);
        return isFinite(v) && v > 0 ? v : 1;
      }
    }
    return 1;
  };

  // Paso 1: peso/volumen (preferente · "1 lata (140 g)" debe dar 140 g).
  for (let i = 0; i < tokens.length; i++) {
    const f = WEIGHT_TO_G[tokens[i]];
    if (f !== undefined) {
      return { grams: Math.round(numBefore(i) * f), scalable: true };
    }
  }
  // Paso 2: unidades discretas.
  for (let i = 0; i < tokens.length; i++) {
    const f = DISCRETE_TO_G[tokens[i]];
    if (f !== undefined) {
      return { grams: Math.round(numBefore(i) * f), scalable: false };
    }
  }
  // Sin unidad reconocible → desconocido (caerá en estimación IA).
  return { grams: null, scalable: false };
}

// Reescribe una `cantidad` de peso/volumen con un nuevo nº de gramos,
// preservando la unidad original (g vs ml). Solo se llama sobre cantidades
// escalables (las que parseQuantity marcó scalable=true). Si no encuentra
// unidad de volumen, usa gramos.
export function rewriteGramsInCantidad(raw: string, newGrams: number): string {
  const g = Math.max(1, Math.round(newGrams));
  const lower = stripAccents(String(raw).toLowerCase());
  const isVolume = /\b(ml|mililitros?|cc|l|litros?|cl|dl)\b/.test(
    lower.replace(/(\d)([a-z])/g, '$1 $2'),
  );
  return isVolume ? `${g} ml` : `${g} g`;
}
