/** Interface languages. Codes are BCP 47 tags so i18next resolves `ar-TN` → `ar` → `fr` by itself,
 * and dialect files only need the wording that differs from Modern Standard Arabic.
 * Dialect text is unreviewed until a native speaker signs it off: docs/i18n/DIALECT_REVIEW.md. */
export type UiLanguage = 'fr' | 'en' | 'ar' | 'ar-TN' | 'ar-IQ' | 'ar-SY';

export interface UiLanguageInfo {
  code: UiLanguage;
  /** Name in the language itself, as people look for it in a list. */
  label: string;
  short: string;
  dir: 'ltr' | 'rtl';
  /** Locale for numbers and dates. Digits stay Latin everywhere: they match scales, labels and lot numbers. */
  intl: string;
  reviewed: boolean;
}

export const UI_LANGUAGES: readonly UiLanguageInfo[] = [
  { code: 'fr', label: 'Français', short: 'FR', dir: 'ltr', intl: 'fr-FR', reviewed: true },
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr', intl: 'en-GB', reviewed: true },
  { code: 'ar', label: 'العربية الفصحى', short: 'ع', dir: 'rtl', intl: 'ar-TN-u-nu-latn', reviewed: true },
  { code: 'ar-TN', label: 'تونسي', short: 'تو', dir: 'rtl', intl: 'ar-TN-u-nu-latn', reviewed: false },
  { code: 'ar-IQ', label: 'عراقي', short: 'عر', dir: 'rtl', intl: 'ar-IQ-u-nu-latn', reviewed: false },
  { code: 'ar-SY', label: 'شامي', short: 'شا', dir: 'rtl', intl: 'ar-SY-u-nu-latn', reviewed: false },
];

export const DEFAULT_LANGUAGE: UiLanguage = 'fr';

export const isUiLanguage = (value: unknown): value is UiLanguage =>
  typeof value === 'string' && UI_LANGUAGES.some((language) => language.code === value);

export const languageInfo = (code: string | undefined): UiLanguageInfo =>
  UI_LANGUAGES.find((language) => language.code === code)
  ?? UI_LANGUAGES.find((language) => code?.startsWith(language.code + '-'))
  ?? UI_LANGUAGES[0];

export const isRTL = (code: string | undefined) => languageInfo(code).dir === 'rtl';

/** Set when a person picks a language; until then the factory default applies. */
export const PERSONAL_LANGUAGE_KEY = 'i18nextLng';
export const PERSONAL_CHOICE_FLAG = 'dhh-language-chosen';
