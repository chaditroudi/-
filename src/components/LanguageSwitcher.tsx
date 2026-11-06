import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chooseLanguage } from '@/i18n';
import { UI_LANGUAGES, languageInfo } from '@/i18n/languages';

export const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const current = languageInfo(i18n.language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${t('language.select')} : ${current.label}`}
          className="h-9 gap-2 px-2 text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden text-sm font-semibold sm:inline">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t('language.select')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {UI_LANGUAGES.map((language) => {
          const active = current.code === language.code;
          return (
            <DropdownMenuItem
              key={language.code}
              onClick={() => void chooseLanguage(language.code)}
              className={cn('min-h-11 cursor-pointer gap-3', active && 'bg-accent text-accent-foreground')}
            >
              <span className="w-7 shrink-0 text-center font-semibold" aria-hidden>{language.short}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={language.code} dir={language.dir}>{language.label}</span>
                {!language.reviewed && <span className="text-xs text-muted-foreground">{t('language.unreviewed')}</span>}
              </span>
              {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
