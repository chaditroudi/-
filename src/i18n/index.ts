import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import arTN from './locales/ar-TN.json';
import arIQ from './locales/ar-IQ.json';
import arSY from './locales/ar-SY.json';
import {
  DEFAULT_LANGUAGE,
  PERSONAL_CHOICE_FLAG,
  PERSONAL_LANGUAGE_KEY,
  isUiLanguage,
  languageInfo,
  type UiLanguage,
} from './languages';

export { isRTL } from './languages';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ar: { translation: ar },
  // Dialects hold only the wording that differs from MSA; i18next falls back ar-TN → ar → fr.
  'ar-TN': { translation: arTN },
  'ar-IQ': { translation: arIQ },
  'ar-SY': { translation: arSY },
};

const readStored = (): UiLanguage | null => {
  try {
    const saved = localStorage.getItem(PERSONAL_LANGUAGE_KEY);
    return isUiLanguage(saved) ? saved : null;
  } catch {
    return null;
  }
};

const stored = readStored();
// A language saved before the factory default existed was the person's own pick.
try { if (stored && !localStorage.getItem(PERSONAL_CHOICE_FLAG)) localStorage.setItem(PERSONAL_CHOICE_FLAG, '1'); } catch { /* private mode */ }

const initialLang: UiLanguage = stored ?? DEFAULT_LANGUAGE;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: { 'ar-TN': ['ar', 'fr'], 'ar-IQ': ['ar', 'fr'], 'ar-SY': ['ar', 'fr'], default: ['fr'] },
    interpolation: {
      escapeValue: false
    }
  });

export const setDocumentDirection = (lang: string) => {
  const info = languageInfo(lang);
  document.documentElement.dir = info.dir;
  document.documentElement.lang = info.code;
};

setDocumentDirection(initialLang);

i18n.on('languageChanged', (lang) => {
  try { localStorage.setItem(PERSONAL_LANGUAGE_KEY, lang); } catch { /* private mode */ }
  setDocumentDirection(lang);
});

/** A person's own choice always wins over the factory default. */
export const chooseLanguage = (lang: UiLanguage) => {
  try { localStorage.setItem(PERSONAL_CHOICE_FLAG, '1'); } catch { /* private mode */ }
  return i18n.changeLanguage(lang);
};

/** Applies the factory's default language when this person has never picked one. */
export const applyFactoryDefaultLanguage = (factoryDefault: unknown) => {
  let chosen = false;
  try { chosen = localStorage.getItem(PERSONAL_CHOICE_FLAG) === '1'; } catch { /* private mode */ }
  if (chosen || !isUiLanguage(factoryDefault) || i18n.language === factoryDefault) return;
  try { localStorage.setItem(PERSONAL_CHOICE_FLAG, 'factory'); } catch { /* private mode */ }
  void i18n.changeLanguage(factoryDefault);
};

export default i18n;
