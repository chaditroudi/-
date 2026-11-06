import i18n from '@/i18n';
import { languageInfo } from '@/i18n/languages';

/** Number and date formatting that follows the interface language.
 * Digits stay Latin in every language: they must match scales, labels, lot numbers and paper forms. */
const locale = () => languageInfo(i18n.language).intl;

const numberFormats = new Map<string, Intl.NumberFormat>();
const numberFormat = (options: Intl.NumberFormatOptions) => {
  const key = locale() + JSON.stringify(options);
  let format = numberFormats.get(key);
  if (!format) { format = new Intl.NumberFormat(locale(), options); numberFormats.set(key, format); }
  return format;
};

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** "1 250,5" in French, "1,250.5" in English. Unknown values stay unknown: returns the fallback, never "0". */
export const formatNumber = (value: number | null | undefined, maximumFractionDigits = 1, fallback = '—') =>
  isNumber(value) ? numberFormat({ maximumFractionDigits }).format(value) : fallback;

export const formatWeight = (kg: number | null | undefined, fallback = '—') =>
  isNumber(kg) ? `${formatNumber(Math.abs(kg) >= 1000 ? Math.round(kg) : kg, 1)} kg` : fallback;

export const formatPercent = (value: number | null | undefined, maximumFractionDigits = 1, fallback = '—') =>
  isNumber(value) ? `${formatNumber(value, maximumFractionDigits)} %` : fallback;

export const formatMoney = (value: number | null | undefined, currency = 'TND', fallback = '—') =>
  isNumber(value) ? numberFormat({ style: 'currency', currency, maximumFractionDigits: currency === 'TND' ? 3 : 2 }).format(value) : fallback;

const toDate = (value: Date | string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value: Date | string | number | null | undefined, fallback = '—') => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : fallback;
};

export const formatTime = (value: Date | string | number | null | undefined, fallback = '—') => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(date) : fallback;
};

export const formatDateTime = (value: Date | string | number | null | undefined, fallback = '—') => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date) : fallback;
};
