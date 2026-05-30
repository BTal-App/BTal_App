import { describe, it, expect } from 'vitest';
import { checkEligibility, maybeResetCycle, CICLO_MS } from './eligibility';
import type { GeneracionesIA, PlanIA } from './types';

// Lógica PURA · es la VERDAD del límite de generaciones (el cliente la
// replica solo para UX). Cubre los 3 niveles (free / one_off / pro), el
// reset de ciclo de 30 días y los bordes. Base del fix TOCTOU de
// generatePlan (la reserva atómica llama a estas mismas funciones).

const NOW = 1_700_000_000_000; // epoch fijo para tests deterministas

function gen(over: Partial<GeneracionesIA> = {}): GeneracionesIA {
  return { menu_at: null, entrenos_at: null, consumidas_ciclo: 0, ciclo_inicio: NOW, ...over };
}
function plan(over: Partial<PlanIA> = {}): PlanIA {
  return { tipo: 'free', vence_en: null, one_off_consumido: false, ...over };
}

describe('maybeResetCycle', () => {
  it('NO resetea dentro del ciclo (< 30 días)', () => {
    const g = gen({ consumidas_ciclo: 1, ciclo_inicio: NOW - 10 * 24 * 60 * 60 * 1000 });
    const r = maybeResetCycle(g, NOW);
    expect(r.reset).toBe(false);
    expect(r.next.consumidas_ciclo).toBe(1);
    expect(r.next.ciclo_inicio).toBe(g.ciclo_inicio);
  });

  it('resetea pasados > 30 días: consumidas→0 y ciclo_inicio→now', () => {
    const g = gen({ consumidas_ciclo: 1, ciclo_inicio: NOW - (CICLO_MS + 1000) });
    const r = maybeResetCycle(g, NOW);
    expect(r.reset).toBe(true);
    expect(r.next.consumidas_ciclo).toBe(0);
    expect(r.next.ciclo_inicio).toBe(NOW);
  });

  it('en el borde EXACTO de 30 días NO resetea (estrictamente >)', () => {
    const g = gen({ consumidas_ciclo: 1, ciclo_inicio: NOW - CICLO_MS });
    expect(maybeResetCycle(g, NOW).reset).toBe(false);
  });

  it('preserva menu_at/entrenos_at al resetear (solo toca consumidas/ciclo)', () => {
    const g = gen({ consumidas_ciclo: 1, ciclo_inicio: NOW - (CICLO_MS + 1), menu_at: 123, entrenos_at: 456 });
    const r = maybeResetCycle(g, NOW);
    expect(r.next.menu_at).toBe(123);
    expect(r.next.entrenos_at).toBe(456);
  });
});

describe('checkEligibility · Free', () => {
  it('permite si no ha consumido en el ciclo', () => {
    const r = checkEligibility(plan(), gen({ consumidas_ciclo: 0 }), NOW);
    expect(r).toEqual({ allowed: true, reason: 'free', consumeOneOff: false });
  });

  it('bloquea si ya consumió · expone unlocksAt = ciclo_inicio + 30 días', () => {
    const cicloInicio = NOW - 5 * 24 * 60 * 60 * 1000;
    const r = checkEligibility(plan(), gen({ consumidas_ciclo: 1, ciclo_inicio: cicloInicio }), NOW);
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe('limit_reached');
      expect(r.unlocksAt).toBe(cicloInicio + CICLO_MS);
    }
  });
});

describe('checkEligibility · Pro', () => {
  it('Pro vigente → ilimitado (allowed, sin consumir one_off)', () => {
    const r = checkEligibility(plan({ tipo: 'pro', vence_en: NOW + 1000 }), gen({ consumidas_ciclo: 99 }), NOW);
    expect(r).toEqual({ allowed: true, reason: 'pro', consumeOneOff: false });
  });

  it('Pro EXPIRADO cae a Free (bloqueado si ya consumió)', () => {
    const r = checkEligibility(plan({ tipo: 'pro', vence_en: NOW - 1000 }), gen({ consumidas_ciclo: 1 }), NOW);
    expect(r.allowed).toBe(false);
  });

  it('Pro con vence_en null NO es pro (cae a Free)', () => {
    const r = checkEligibility(plan({ tipo: 'pro', vence_en: null }), gen({ consumidas_ciclo: 0 }), NOW);
    expect(r).toEqual({ allowed: true, reason: 'free', consumeOneOff: false });
  });
});

describe('checkEligibility · One-off (4,99€)', () => {
  it('vigente y no consumido → permitido y marca consumeOneOff', () => {
    const r = checkEligibility(
      plan({ tipo: 'one_off', vence_en: NOW + 1000, one_off_consumido: false }),
      gen({ consumidas_ciclo: 1 }), // aunque ya gastó el free del ciclo
      NOW,
    );
    expect(r).toEqual({ allowed: true, reason: 'one_off', consumeOneOff: true });
  });

  it('ya consumido → cae a Free (bloqueado si gastó el ciclo)', () => {
    const r = checkEligibility(
      plan({ tipo: 'one_off', vence_en: NOW + 1000, one_off_consumido: true }),
      gen({ consumidas_ciclo: 1 }),
      NOW,
    );
    expect(r.allowed).toBe(false);
  });

  it('expirado → cae a Free', () => {
    const r = checkEligibility(
      plan({ tipo: 'one_off', vence_en: NOW - 1000, one_off_consumido: false }),
      gen({ consumidas_ciclo: 0 }),
      NOW,
    );
    expect(r).toEqual({ allowed: true, reason: 'free', consumeOneOff: false });
  });
});

describe('flujo de reserva (espejo de generatePlan)', () => {
  it('ciclo vencido + consumido: reset → vuelve a ser elegible como free', () => {
    const g = gen({ consumidas_ciclo: 1, ciclo_inicio: NOW - (CICLO_MS + 1) });
    const { next } = maybeResetCycle(g, NOW);
    const r = checkEligibility(plan(), next, NOW);
    expect(r).toEqual({ allowed: true, reason: 'free', consumeOneOff: false });
  });
});
