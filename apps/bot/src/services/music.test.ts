import { describe, expect, it } from 'vitest';
import { formatDuration } from './music';

describe('formatDuration', () => {
  it('formate les secondes seules', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(59)).toBe('0:59');
  });

  it('formate les minutes', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('formate les heures', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7384)).toBe('2:03:04');
  });

  it('gère les grands nombres', () => {
    expect(formatDuration(86400)).toBe('24:00:00');
    expect(formatDuration(90061)).toBe('25:01:01');
  });
});
