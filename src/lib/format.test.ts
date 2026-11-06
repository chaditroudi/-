import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { formatDate, formatNumber, formatPercent, formatWeight } from './format';

afterEach(async () => { await i18n.changeLanguage('fr'); });

describe('locale-aware formatting', () => {
  it('never turns an unknown value into zero', () => {
    expect(formatNumber(undefined)).toBe('—');
    expect(formatWeight(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });

  it('follows the interface language', async () => {
    await i18n.changeLanguage('fr');
    expect(formatNumber(1250.5).replace(/\s/g, ' ')).toBe('1 250,5');
    await i18n.changeLanguage('en');
    expect(formatNumber(1250.5)).toBe('1,250.5');
  });

  it('keeps Latin digits in Arabic and its dialects, as on scales and labels', async () => {
    for (const lang of ['ar', 'ar-TN', 'ar-IQ', 'ar-SY']) {
      await i18n.changeLanguage(lang);
      // Arabic-Indic digits (U+0660 to U+0669) must never appear.
      expect(formatWeight(900)).not.toMatch(/[٠-٩]/);
      expect(formatWeight(900)).toBe('900 kg');
    }
  });
});
