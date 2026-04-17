import { describe, it, expect } from 'vitest';
import { selectAllModifier } from './ckeditor5';

describe('selectAllModifier', () => {
  it('returns Meta on darwin', () => {
    expect(selectAllModifier('darwin')).toBe('Meta');
  });

  it('returns Control on linux', () => {
    expect(selectAllModifier('linux')).toBe('Control');
  });

  it('returns Control on win32', () => {
    expect(selectAllModifier('win32')).toBe('Control');
  });

  it('returns Control on freebsd / other', () => {
    expect(selectAllModifier('freebsd')).toBe('Control');
  });
});
