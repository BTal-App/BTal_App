import { describe, it, expect } from 'vitest';
import { parseQuantity, rewriteGramsInCantidad } from './quantity';
import { normalizeFoodKey } from './foodCache';

describe('parseQuantity', () => {
  it('peso en gramos (escalable)', () => {
    expect(parseQuantity('60 g')).toEqual({ grams: 60, scalable: true });
    expect(parseQuantity('60g')).toEqual({ grams: 60, scalable: true });
    expect(parseQuantity('150 gramos')).toEqual({ grams: 150, scalable: true });
    expect(parseQuantity('1 kg')).toEqual({ grams: 1000, scalable: true });
  });

  it('volumen ≈ gramos (escalable)', () => {
    expect(parseQuantity('250 ml')).toEqual({ grams: 250, scalable: true });
    expect(parseQuantity('1,5 l')).toEqual({ grams: 1500, scalable: true });
  });

  it('unidades discretas (NO escalable)', () => {
    expect(parseQuantity('1 plátano')).toEqual({ grams: 120, scalable: false });
    expect(parseQuantity('2 huevos')).toEqual({ grams: 110, scalable: false });
    expect(parseQuantity('1 cucharada')).toEqual({ grams: 15, scalable: false });
    expect(parseQuantity('1 loncha')).toEqual({ grams: 20, scalable: false });
  });

  it('prefiere el peso explícito dentro de paréntesis', () => {
    expect(parseQuantity('1 lata (140 g escurrido)')).toEqual({ grams: 140, scalable: true });
  });

  it('fracciones', () => {
    expect(parseQuantity('1/2 aguacate')).toEqual({ grams: 100, scalable: false });
    expect(parseQuantity('½ vaso')).toEqual({ grams: 100, scalable: false });
    expect(parseQuantity('medio plátano')).toEqual({ grams: 60, scalable: false });
  });

  it('sin unidad reconocible → null', () => {
    expect(parseQuantity('al gusto')).toEqual({ grams: null, scalable: false });
    expect(parseQuantity('')).toEqual({ grams: null, scalable: false });
    expect(parseQuantity('1 unidad')).toEqual({ grams: null, scalable: false });
  });
});

describe('rewriteGramsInCantidad', () => {
  it('reescribe gramos preservando la unidad', () => {
    expect(rewriteGramsInCantidad('60 g', 90)).toBe('90 g');
    expect(rewriteGramsInCantidad('250 ml', 300)).toBe('300 ml');
    expect(rewriteGramsInCantidad('60g de avena', 88)).toBe('88 g');
  });
});

describe('normalizeFoodKey', () => {
  it('normaliza acentos, cocción y orden de palabras', () => {
    expect(normalizeFoodKey('Pechuga de pollo a la plancha')).toBe(normalizeFoodKey('pollo pechuga'));
    expect(normalizeFoodKey('Arroz blanco cocido')).toBe('arroz_blanco');
    expect(normalizeFoodKey('Plátano')).toBe('platano');
  });
  it('vacío si no queda nada', () => {
    expect(normalizeFoodKey('')).toBe('');
    expect(normalizeFoodKey('de la con')).toBe('');
  });
});
