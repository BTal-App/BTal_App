import { describe, expect, it } from 'vitest';
import {
  formatTiempoEstimado,
  horaToMinutes,
  parseTiempoEstimado,
} from './timeParser';

describe('parseTiempoEstimado', () => {
  it('parsea solo número como minutos', () => {
    expect(parseTiempoEstimado('45')).toBe(45);
    expect(parseTiempoEstimado('90')).toBe(90);
    expect(parseTiempoEstimado('  60  ')).toBe(60);
  });

  it('parsea horas + minutos en distintos formatos', () => {
    expect(parseTiempoEstimado('1h')).toBe(60);
    expect(parseTiempoEstimado('1h 20min')).toBe(80);
    expect(parseTiempoEstimado('1h20')).toBe(80);
    expect(parseTiempoEstimado('2h 5')).toBe(125);
    expect(parseTiempoEstimado('45min')).toBe(45);
    expect(parseTiempoEstimado('45 min')).toBe(45);
  });

  it('devuelve null en input vacío/inválido/cero', () => {
    expect(parseTiempoEstimado('')).toBeNull();
    expect(parseTiempoEstimado('   ')).toBeNull();
    expect(parseTiempoEstimado('abc')).toBeNull();
    expect(parseTiempoEstimado('0')).toBeNull();
  });
});

describe('formatTiempoEstimado', () => {
  it('formatea minutos según las reglas (m / h / h m)', () => {
    expect(formatTiempoEstimado(45)).toBe('45m');
    expect(formatTiempoEstimado(60)).toBe('1h');
    expect(formatTiempoEstimado(75)).toBe('1h 15m');
    expect(formatTiempoEstimado(120)).toBe('2h');
  });

  it('devuelve cadena vacía para null/undefined/<=0', () => {
    expect(formatTiempoEstimado(null)).toBe('');
    expect(formatTiempoEstimado(undefined)).toBe('');
    expect(formatTiempoEstimado(0)).toBe('');
    expect(formatTiempoEstimado(-5)).toBe('');
  });
});

describe('horaToMinutes', () => {
  it('convierte HH:mm a minutos del día', () => {
    expect(horaToMinutes('08:30')).toBe(8 * 60 + 30);
    expect(horaToMinutes('00:00')).toBe(0);
    expect(horaToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('devuelve fin del día para valores ausentes/malformados/fuera de rango', () => {
    const finDia = 24 * 60;
    expect(horaToMinutes(null)).toBe(finDia);
    expect(horaToMinutes(undefined)).toBe(finDia);
    expect(horaToMinutes('')).toBe(finDia);
    expect(horaToMinutes('25:00')).toBe(finDia);
    expect(horaToMinutes('08:99')).toBe(finDia);
    expect(horaToMinutes('foo')).toBe(finDia);
    expect(horaToMinutes('08')).toBe(finDia);
  });
});
