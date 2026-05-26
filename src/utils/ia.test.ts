import { describe, expect, it } from 'vitest';
import { canGenerateAi } from './ia';
import type { UserDocument } from '../templates/defaultUser';

// Helper minimal · solo rellenamos lo que la función lee, el resto se
// castea (`canGenerateAi` no toca menú/entrenos/compra/etc.).
function makeUserDoc(overrides: {
  modo?: 'manual' | 'ai';
  planTipo?: 'free' | 'one_off' | 'pro';
  venceEn?: number | null;
  oneOffConsumido?: boolean;
  consumidas?: number;
  cicloInicio?: number;
}): UserDocument {
  return {
    profile: { modo: overrides.modo ?? 'ai' },
    plan: {
      tipo: overrides.planTipo ?? 'free',
      vence_en: overrides.venceEn ?? null,
      one_off_consumido: overrides.oneOffConsumido ?? false,
    },
    generaciones: {
      menu_at: null,
      entrenos_at: null,
      consumidas_ciclo: overrides.consumidas ?? 0,
      ciclo_inicio: overrides.cicloInicio ?? Date.now(),
    },
  } as unknown as UserDocument;
}

const NOW = Date.now();
const FUTURE = NOW + 1000 * 60 * 60 * 24 * 7; // dentro de 7 días
const PAST = NOW - 1000 * 60 * 60 * 24 * 7;   // hace 7 días

describe('canGenerateAi', () => {
  it('bloquea a invitados anónimos siempre', () => {
    const r = canGenerateAi(makeUserDoc({ modo: 'ai' }), true);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('guest');
    expect(r.hint).toContain('cuenta');
  });

  it('bloquea con userDoc null', () => {
    const r = canGenerateAi(null, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('manual_mode');
  });

  it('bloquea si modo es manual y sugiere cambiarlo', () => {
    const r = canGenerateAi(makeUserDoc({ modo: 'manual' }), false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('manual_mode');
    expect(r.hint).toContain('Modo IA');
  });

  it('permite a Pro vigente sin restricciones', () => {
    const r = canGenerateAi(
      makeUserDoc({ planTipo: 'pro', venceEn: FUTURE }),
      false,
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('ok_pro');
  });

  it('NO permite a Pro caducado · cae a la lógica Free', () => {
    const r = canGenerateAi(
      makeUserDoc({ planTipo: 'pro', venceEn: PAST, consumidas: 0 }),
      false,
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('ok_free'); // tiene su gen del mes disponible
  });

  it('permite one_off vigente y no consumido', () => {
    const r = canGenerateAi(
      makeUserDoc({
        planTipo: 'one_off',
        venceEn: FUTURE,
        oneOffConsumido: false,
      }),
      false,
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('ok_one_off');
  });

  it('NO permite one_off si ya se consumió · cae a Free', () => {
    const r = canGenerateAi(
      makeUserDoc({
        planTipo: 'one_off',
        venceEn: FUTURE,
        oneOffConsumido: true,
        consumidas: 0,
      }),
      false,
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('ok_free');
  });

  it('permite Free si consumidas_ciclo == 0', () => {
    const r = canGenerateAi(
      makeUserDoc({ planTipo: 'free', consumidas: 0 }),
      false,
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('ok_free');
  });

  it('bloquea Free si ya gastó su gen del mes y expone unlocksAt + fecha en hint', () => {
    const cicloInicio = NOW;
    const r = canGenerateAi(
      makeUserDoc({ planTipo: 'free', consumidas: 1, cicloInicio }),
      false,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('limit_reached');
    expect(r.unlocksAt).toBeGreaterThan(NOW);
    // ~30 días después del cicloInicio
    const diff = (r.unlocksAt ?? 0) - cicloInicio;
    expect(diff).toBeGreaterThan(28 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(32 * 24 * 60 * 60 * 1000);
    expect(r.hint).toContain('4,99');
    expect(r.hint).toContain('Pro');
  });
});
