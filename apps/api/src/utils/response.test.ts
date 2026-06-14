import { describe, it, expect } from 'vitest';
import { success, error, getErrorMessage, paginated } from './response';

describe('success()', () => {
  it('returns a success response with data', () => {
    const res = success({ id: 1, name: 'test' });
    expect(res).toEqual({
      success: true,
      data: { id: 1, name: 'test' },
    });
  });

  it('includes message when provided', () => {
    const res = success('done', 'Opération réussie');
    expect(res).toEqual({
      success: true,
      data: 'done',
      message: 'Opération réussie',
    });
  });

  it('works with null data', () => {
    const res = success(null);
    expect(res.success).toBe(true);
    expect(res.data).toBeNull();
  });

  it('works with array data', () => {
    const res = success([1, 2, 3]);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([1, 2, 3]);
  });

  it('does not include message key when omitted', () => {
    const res = success('data');
    expect(res).not.toHaveProperty('message');
  });
});

describe('error()', () => {
  it('returns an error response with message', () => {
    const res = error('Quelque chose a échoué');
    expect(res).toEqual({
      success: false,
      error: 'Quelque chose a échoué',
    });
  });

  it('includes details when provided', () => {
    const res = error('Erreur', { field: 'email', code: 400 });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Erreur');
    expect(res.data).toEqual({ field: 'email', code: 400 });
  });

  it('works with empty string message', () => {
    const res = error('');
    expect(res.success).toBe(false);
    expect(res.error).toBe('');
  });

  it('does not include data key when details omitted', () => {
    const res = error('fail');
    expect(res).not.toHaveProperty('data');
  });
});

describe('getErrorMessage()', () => {
  it('returns message from Error instance', () => {
    const err = new Error('Erreur test');
    expect(getErrorMessage(err)).toBe('Erreur test');
  });

  it('returns the string directly', () => {
    expect(getErrorMessage('erreur brute')).toBe('erreur brute');
  });

  it('returns fallback for unknown types', () => {
    expect(getErrorMessage(null)).toBe('Erreur inconnue');
    expect(getErrorMessage(undefined)).toBe('Erreur inconnue');
    expect(getErrorMessage(42)).toBe('Erreur inconnue');
    expect(getErrorMessage({})).toBe('Erreur inconnue');
    expect(getErrorMessage(true)).toBe('Erreur inconnue');
  });

  it('handles Error with empty message', () => {
    expect(getErrorMessage(new Error(''))).toBe('');
  });

  it('handles empty string', () => {
    expect(getErrorMessage('')).toBe('');
  });
});

describe('paginated()', () => {
  it('returns paginated response with correct structure', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const res = paginated(items, 10, 1, 5);

    expect(res.success).toBe(true);
    expect(res.data).toEqual(items);
    expect(res.pagination).toEqual({
      page: 1,
      limit: 5,
      total: 10,
      totalPages: 2,
    });
  });

  it('handles empty data array', () => {
    const res = paginated([], 0, 1, 20);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
    expect(res.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('calculates totalPages correctly for exact division', () => {
    const res = paginated([1, 2, 3, 4, 5], 10, 1, 5);
    expect(res.pagination?.totalPages).toBe(2);
  });

  it('calculates totalPages correctly with remainder', () => {
    const res = paginated([1, 2, 3], 10, 1, 5);
    expect(res.pagination?.totalPages).toBe(2);
  });

  it('handles single page', () => {
    const res = paginated([1, 2, 3], 3, 1, 10);
    expect(res.pagination?.totalPages).toBe(1);
  });
});
