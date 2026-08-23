import EcodatteLogo from '@/assets/EcodatteLogo.png';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { PRINT_BRAND_FALLBACK, PRODUCT } from '@/lib/productMeta';

const toInitials = (value: string) => {
  const initials = value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || PRINT_BRAND_FALLBACK.companyShortName;
};

/**
 * Live plant brand for UI. Never hard-code a single manufacturer —
 * configure Settings → Usine / Branding per deploy (Royale Palm, EcoDatte, Bioscha, …).
 */
export function useBranding() {
  const { settings } = useSettingsContext();

  const companyName = settings.company_name?.trim() || DEFAULT_SETTINGS.company_name;
  const companyShortName = settings.company_short_name?.trim() || toInitials(companyName);
  const companyLegalName =
    settings.company_legal_name?.trim() || companyName;
  const plantName = settings.plant_name?.trim() || DEFAULT_SETTINGS.plant_name;
  const plantEmail = settings.plant_email?.trim() || null;
  const plantPhone = settings.plant_phone?.trim() || null;
  const plantAddress = settings.plant_address?.trim() || null;
  const siteCode = settings.site_code?.trim() || DEFAULT_SETTINGS.site_code;
  const countryCode = settings.country_code?.trim() || DEFAULT_SETTINGS.country_code;
  const customLogoSrc = settings.logo_base64?.trim() || settings.logo_url?.trim() || null;

  const footprint = [plantName, countryCode].filter(Boolean).join(' · ');
  const printFooter = [companyLegalName || companyName, plantName, countryCode]
    .filter(Boolean)
    .join(' · ');

  return {
    productName: PRODUCT.name,
    commercialName: PRODUCT.commercialName,
    tagline: PRODUCT.tagline,
    companyName,
    companyShortName,
    companyLegalName,
    plantName,
    plantEmail,
    plantPhone,
    plantAddress,
    siteCode,
    countryCode,
    footprint,
    printFooter,
    customLogoSrc,
    fallbackLogoSrc: EcodatteLogo,
    logoSrc: customLogoSrc || EcodatteLogo,
    primaryColor: settings.primary_color || DEFAULT_SETTINGS.primary_color,
    accentColor: settings.accent_color || DEFAULT_SETTINGS.accent_color,
  };
}

export type PlantBrand = ReturnType<typeof useBranding>;
