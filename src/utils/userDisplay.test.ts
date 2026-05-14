import { describe, expect, it } from 'vitest';
import type { User } from 'firebase/auth';
import {
  initialsOf,
  greetingName,
  formatDate,
  providerLabel,
  toTitleCase,
} from './userDisplay';

// Tests inaugurales del banco de Vitest · cubren las 4 funciones puras
// de userDisplay. Sin deps externas · validan los casos límite que ya
// existen en runtime (avatar fallback, saludos, fechas en es-ES,
// providerId desconocido).

describe('initialsOf', () => {
  it('saca 2 iniciales en mayúscula de un nombre completo', () => {
    expect(initialsOf('Pablo Castillo')).toBe('PC');
  });

  it('cae a la primera inicial cuando solo hay un nombre', () => {
    expect(initialsOf('Pablo')).toBe('P');
  });

  it('parsea email split por @ . _ - cuando no hay nombre', () => {
    // 'pablo@btal.app' → parts ['pablo','btal','app'] → 'P' + 'B'
    expect(initialsOf(null, 'pablo@btal.app')).toBe('PB');
  });

  it('devuelve "?" sin nombre ni email', () => {
    expect(initialsOf(null, null)).toBe('?');
    expect(initialsOf(undefined, undefined)).toBe('?');
    expect(initialsOf('   ', null)).toBe('?');
  });

  it('respeta nombres con guiones bajos o puntos', () => {
    expect(initialsOf('maria.lopez')).toBe('ML');
    expect(initialsOf('juan_perez')).toBe('JP');
  });
});

describe('greetingName', () => {
  it('devuelve el primer token del displayName', () => {
    const user = { displayName: 'Pablo Castillo' } as User;
    expect(greetingName(user)).toBe('Pablo');
  });

  it('devuelve null cuando displayName es vacío o whitespace', () => {
    expect(greetingName({ displayName: '' } as User)).toBeNull();
    expect(greetingName({ displayName: '   ' } as User)).toBeNull();
    expect(greetingName({ displayName: null } as unknown as User)).toBeNull();
  });
});

describe('formatDate', () => {
  it('formatea ISO a dd/mm/aaaa en es-ES', () => {
    // Fecha UTC fija · evita TZ shifts pasando una hora cómoda (12:00).
    expect(formatDate('2026-05-12T12:00:00Z')).toBe('12/05/2026');
  });

  it('devuelve "—" para entradas inválidas o vacías', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('no-soy-una-fecha')).toBe('—');
  });
});

describe('providerLabel', () => {
  it('devuelve la etiqueta humana para providers conocidos', () => {
    expect(providerLabel('password')).toBe('Email y contraseña');
    expect(providerLabel('google.com')).toBe('Google');
    expect(providerLabel('anonymous')).toBe('Anónimo');
  });

  it('devuelve el id tal cual para providers desconocidos', () => {
    expect(providerLabel('saml.weird-provider')).toBe('saml.weird-provider');
  });
});

describe('toTitleCase', () => {
  it('capitaliza la primera letra de cada palabra en minúsculas', () => {
    expect(toTitleCase('pablo rodriguez')).toBe('Pablo Rodriguez');
  });

  it('baja a minúscula los textos enteros en mayúscula antes de subir las iniciales', () => {
    expect(toTitleCase('PABLO RODRIGUEZ')).toBe('Pablo Rodriguez');
  });

  it('es idempotente para nombres ya en Title Case', () => {
    expect(toTitleCase('Pablo Rodriguez')).toBe('Pablo Rodriguez');
  });

  it('preserva acentos españoles y la ñ', () => {
    expect(toTitleCase('maría josé')).toBe('María José');
    expect(toTitleCase('iñaki muñoz')).toBe('Iñaki Muñoz');
  });

  it('aplica trim y colapsa espacios múltiples', () => {
    expect(toTitleCase('  pablo   pérez  ')).toBe('Pablo Pérez');
  });

  it('capitaliza tras guion y apóstrofe (nombres compuestos)', () => {
    expect(toTitleCase('jean-pierre')).toBe('Jean-Pierre');
    expect(toTitleCase("o'connor")).toBe("O'Connor");
  });

  it('devuelve "" para entradas vacías o null/undefined', () => {
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase('   ')).toBe('');
    expect(toTitleCase(null)).toBe('');
    expect(toTitleCase(undefined)).toBe('');
  });

  it('funciona con un solo nombre', () => {
    expect(toTitleCase('pablo')).toBe('Pablo');
    expect(toTitleCase('PABLO')).toBe('Pablo');
  });
});
