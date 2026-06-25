import EcodatteLogo from '@/assets/EcodatteLogo.png';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { DEFAULT_SETTINGS } from '@/types/settings';

const toInitials = (value: string) => {
  const initials = value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'RP';
};

export function useBranding() {
  const { settings } = useSettingsContext();

  const companyName = settings.company_name?.trim() || DEFAULT_SETTINGS.company_name;
  const companyShortName = settings.company_short_name?.trim() || toInitials(companyName);
  const customLogoSrc = settings.logo_base64?.trim() || settings.logo_url?.trim() || null;

  return {
    companyName,
    companyShortName,
    customLogoSrc,
    fallbackLogoSrc: EcodatteLogo,
    logoSrc: customLogoSrc || EcodatteLogo,
  };
}
