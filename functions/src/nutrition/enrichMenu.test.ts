import { describe, it, expect } from 'vitest';
import { enrichAndAdjustMenu } from './enrichMenu';
import { normalizeFoodKey, type MacrosPer100 } from './foodCache';
import { DAY_KEYS, type Comida, type ComidasDelDia, type Menu } from '../types';
import type { ValidatedProfile } from '../schemas';

function prof(over: Partial<ValidatedProfile> = {}): ValidatedProfile {
  return {
    nombre: 'Test',
    edad: 30,
    peso: 70,
    altura: 175,
    sexo: 'm',
    actividad: 'moderado',
    diasEntreno: 4,
    equipamiento: 'gimnasio',
    objetivo: 'mantenimiento',
    restricciones: [],
    notas: '',
    intolerancias: [],
    alergias: [],
    alimentosProhibidos: [],
    alimentosObligatorios: [],
    ingredientesFavoritos: [],
    objetivoKcal: 2000, // fija el target para tests deterministas
    supermercados: [],
    ...over,
  };
}

function comida(over: Partial<Comida> = {}): Comida {
  return {
    alimentos: [],
    hora: null,
    kcal: 0,
    prot: 0,
    carb: 0,
    fat: 0,
    source: 'ai',
    emoji: null,
    nombrePlato: null,
    ...over,
  };
}

function emptyDay(): ComidasDelDia {
  return { desayuno: comida(), comida: comida(), merienda: comida(), cena: comida(), extras: [] };
}

function emptyMenu(): Menu {
  const m = {} as Menu;
  for (const d of DAY_KEYS) m[d] = emptyDay();
  return m;
}

// kcalPer100 simple (prot/carb/fat 0 · solo medimos kcal en estos tests).
function m100(kcal: number): MacrosPer100 {
  return { kcalPer100: kcal, protPer100: 0, carbPer100: 0, fatPer100: 0 };
}

describe('enrichAndAdjustMenu', () => {
  it('escala los gramos hacia arriba para alcanzar el objetivo', () => {
    const menu = emptyMenu();
    const nombres = ['Pollo', 'Arroz', 'Pasta', 'Pan'];
    const meals: (keyof Omit<ComidasDelDia, 'extras'>)[] = ['desayuno', 'comida', 'merienda', 'cena'];
    const macros = new Map<string, MacrosPer100 | null>();
    meals.forEach((meal, i) => {
      menu.lun[meal] = comida({
        alimentos: [{ nombre: nombres[i], cantidad: '100 g' }],
        kcal: 375, // real ≈ AI
      });
      macros.set(normalizeFoodKey(nombres[i]), m100(375));
    });

    enrichAndAdjustMenu(menu, prof(), macros);

    // 4×375 = 1500 real · target 2000 → f≈1.33 → 100 g → 133 g.
    expect(menu.lun.desayuno.alimentos[0].cantidad).toBe('133 g');
    const total = meals.reduce((s, m) => s + menu.lun[m].kcal, 0);
    expect(Math.abs(total - 2000) / 2000).toBeLessThanOrEqual(0.05);
  });

  it('no toca las unidades discretas, solo las escalables', () => {
    const menu = emptyMenu();
    menu.lun.desayuno = comida({
      alimentos: [
        { nombre: 'Huevos', cantidad: '2 huevos' }, // discreto → no escala
        { nombre: 'Arroz', cantidad: '100 g' }, // escalable
      ],
      kcal: 300,
    });
    const macros = new Map<string, MacrosPer100 | null>([
      [normalizeFoodKey('Huevos'), m100(155)],
      [normalizeFoodKey('Arroz'), m100(130)],
    ]);

    enrichAndAdjustMenu(menu, prof(), macros);

    expect(menu.lun.desayuno.alimentos[0].cantidad).toBe('2 huevos'); // intacto
    expect(menu.lun.desayuno.alimentos[1].cantidad).not.toBe('100 g'); // escalado
  });

  it('una comida sin nada resuelto conserva las macros de la IA', () => {
    const menu = emptyMenu();
    menu.lun.comida = comida({
      alimentos: [{ nombre: 'Salsa artesanal rara', cantidad: 'al gusto' }],
      kcal: 400,
    });
    enrichAndAdjustMenu(menu, prof(), new Map());
    expect(menu.lun.comida.kcal).toBe(400);
  });

  it('respeta el clamp (no escala más de 2x)', () => {
    const menu = emptyMenu();
    menu.lun.desayuno = comida({
      alimentos: [{ nombre: 'Arroz', cantidad: '100 g' }],
      kcal: 130,
    });
    const macros = new Map<string, MacrosPer100 | null>([[normalizeFoodKey('Arroz'), m100(130)]]);
    enrichAndAdjustMenu(menu, prof(), macros);
    // gap enorme (130 → 2000) pero clamp 2.0 → 200 g, 260 kcal (no 2000).
    expect(menu.lun.desayuno.alimentos[0].cantidad).toBe('200 g');
    expect(menu.lun.desayuno.kcal).toBe(260);
  });
});
