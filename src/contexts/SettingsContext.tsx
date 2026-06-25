import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings, SiteFeatures } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const applyTheme = (settings: SiteSettings) => {
  const root = document.documentElement;
  if (/^#[0-9a-f]{6}$/i.test(settings.primary_color)) {
    const hsl = hexToHsl(settings.primary_color);
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--sidebar-primary', hsl);
    root.style.setProperty('--sidebar-ring', hsl);
  }
  if (/^#[0-9a-f]{6}$/i.test(settings.accent_color)) {
    const accentHsl = hexToHsl(settings.accent_color);
    root.style.setProperty('--accent', accentHsl);
    root.style.setProperty('--sidebar-accent', accentHsl);
  }
  root.dataset.uiDensity = settings.interface.ui_density;
  root.dataset.uiAnimations = settings.interface.enable_animations ? 'on' : 'off';
};

interface SettingsContextValue {
  settings: SiteSettings;
  isLoading: boolean;
  isFeatureEnabled: (feature: keyof SiteFeatures) => boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  isFeatureEnabled: () => true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings = DEFAULT_SETTINGS, isLoading } = useSiteSettings();

  useEffect(() => {
    if (!isLoading) applyTheme(settings);
  }, [settings, isLoading]);

  const isFeatureEnabled = useCallback(
    (feature: keyof SiteFeatures) => settings.features?.[feature] ?? true,
    [settings.features],
  );

  const value = useMemo(
    () => ({ settings, isLoading, isFeatureEnabled }),
    [settings, isLoading, isFeatureEnabled],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettingsContext = () => useContext(SettingsContext);
