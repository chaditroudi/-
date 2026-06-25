import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ar: { translation: ar }
};

// Honour saved preference; default to French if nothing stored or unrecognised
const savedLang = localStorage.getItem('i18nextLng');
const initialLang: string = (savedLang === 'fr' || savedLang === 'en' || savedLang === 'ar') ? savedLang : 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false
    }
  });

export const isRTL = (lang: string) => lang === 'ar';

export const setDocumentDirection = (lang: string) => {
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
};

// Set initial direction
setDocumentDirection(initialLang);

// Persist preference and update direction on every language change
i18n.on('languageChanged', (lang) => {
  localStorage.setItem('i18nextLng', lang);
  setDocumentDirection(lang);
});

export default i18n;
