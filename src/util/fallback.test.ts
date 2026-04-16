import { describe, it, expect } from 'vitest';
import { idPrefixSelector } from './fallback';

describe('idPrefixSelector', () => {
  it('rewrites a simple #id selector', () => {
    expect(idPrefixSelector('#edit-title')).toBe('[id="edit-title"], [id^="edit-title--"]');
  });

  it('rewrites IDs with digits and multiple hyphens', () => {
    expect(idPrefixSelector('#edit-field-body-0-value')).toBe(
      '[id="edit-field-body-0-value"], [id^="edit-field-body-0-value--"]',
    );
  });

  it('rewrites every #id in a comma-separated selector', () => {
    expect(idPrefixSelector('#foo, #bar')).toBe(
      '[id="foo"], [id^="foo--"], [id="bar"], [id^="bar--"]',
    );
  });

  it('leaves non-ID selectors unchanged', () => {
    expect(idPrefixSelector('.foo')).toBe('.foo');
    expect(idPrefixSelector('input[type=text]')).toBe('input[type=text]');
  });

  it('rewrites #id chunks inside compound selectors', () => {
    expect(idPrefixSelector('#edit-body-wrapper .ck-editor')).toBe(
      '[id="edit-body-wrapper"], [id^="edit-body-wrapper--"] .ck-editor',
    );
  });

  it('handles whitespace-only input', () => {
    expect(idPrefixSelector('  ')).toBe('  ');
  });
});
