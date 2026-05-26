import { describe, expect, it } from 'vitest';
import { calcularObjetivoKcal, objetivoKcalEfectivo } from './calorias';
import type { UserProfile } from '../templates/defaultUser';

// Solo necesitamos los campos que la función realmente lee; el resto
// se rellena minimal con `as UserProfile` para evitar mantenimiento
// si el schema crece (cubre cualquier cosa que no toque `calcularObjetivoKcal`).
function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    edad: 30,
    peso: 70,
    altura: 175,
    sexo: 'm',
    actividad: 'moderado',
    objetivo: 'mantenimiento',
    objetivoKcal: null,
    ...overrides,
  } as UserProfile;
}

describe('calcularObjetivoKcal', () => {
  it('devuelve null si falta cualquier campo obligatorio', () => {
    expect(calcularObjetivoKcal(makeProfile({ edad: null }))).toBeNull();
    expect(calcularObjetivoKcal(makeProfile({ peso: null }))).toBeNull();
    expect(calcularObjetivoKcal(makeProfile({ altura: null }))).toBeNull();
    expect(calcularObjetivoKcal(makeProfile({ sexo: null }))).toBeNull();
    expect(calcularObjetivoKcal(makeProfile({ actividad: null }))).toBeNull();
    expect(calcularObjetivoKcal(makeProfile({ objetivo: null }))).toBeNull();
  });

  it('aplica Mifflin-St Jeor + factor actividad para hombre sedentario en mantenimiento', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    // TDEE = 1648.75 * 1.2 = 1978.5 → redondeo decena → 1980
    expect(
      calcularObjetivoKcal(
        makeProfile({ sexo: 'm', actividad: 'sedentario', objetivo: 'mantenimiento' }),
      ),
    ).toBe(1980);
  });

  it('aplica fórmula mujer y suma +500 para volumen', () => {
    // Mujer: BMR = 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    // TDEE moderado = 1345.25 * 1.55 = 2085.13... + 500 volumen = 2585.13...
    // → redondeo decena = 2590
    expect(
      calcularObjetivoKcal(
        makeProfile({
          sexo: 'f',
          edad: 25,
          peso: 60,
          altura: 165,
          actividad: 'moderado',
          objetivo: 'volumen',
        }),
      ),
    ).toBe(2590);
  });

  it('resta 500 para definición', () => {
    // Hombre 30/70/175/moderado: BMR=1648.75 · TDEE=1648.75*1.55=2555.56 · -500 = 2055.56 → 2060
    expect(
      calcularObjetivoKcal(
        makeProfile({ objetivo: 'definicion', actividad: 'moderado' }),
      ),
    ).toBe(2060);
  });

  it('redondea a la decena más cercana', () => {
    // No verificamos número exacto, solo que el último dígito sea 0
    const kcal = calcularObjetivoKcal(makeProfile({ actividad: 'activo' }));
    expect(kcal).not.toBeNull();
    expect(kcal! % 10).toBe(0);
  });
});

describe('objetivoKcalEfectivo', () => {
  it('devuelve null si profile es null/undefined', () => {
    expect(objetivoKcalEfectivo(null)).toBeNull();
    expect(objetivoKcalEfectivo(undefined)).toBeNull();
  });

  it('prioriza objetivoKcal manual sobre el cálculo', () => {
    expect(objetivoKcalEfectivo(makeProfile({ objetivoKcal: 2500 }))).toBe(2500);
  });

  it('cae al cálculo si objetivoKcal es null', () => {
    const calc = calcularObjetivoKcal(makeProfile());
    expect(objetivoKcalEfectivo(makeProfile())).toBe(calc);
  });
});
