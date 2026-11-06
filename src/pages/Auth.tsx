import { useEffect, useState } from 'react';
import { PRODUCT } from '@/lib/productMeta';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { useBranding } from '@/hooks/useBranding';
import { cn } from '@/lib/utils';

export default function Auth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, isLoading: isAuthLoading } = useAuthContext();
  const { companyName, companyShortName } = useBranding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isRTL = i18n.language.startsWith('ar');

  useEffect(() => {
    if (!isAuthLoading && user) navigate('/');
  }, [user, isAuthLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      await signIn(email, password);
      toast({ title: t('messages.saveSuccess'), description: t('home.welcome') });
      navigate('/');
    } catch (err: any) {
      const message = err?.message || t('messages.loadError');
      setFormError(message);
      toast({
        title: t('common.error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10"
    >

      {/* ── Language switcher ── */}
      <div className="absolute end-4 top-4 z-10">
        <div className="rounded-xl border border-border/60 bg-card p-0.5">
          <LanguageSwitcher />
        </div>
      </div>

      {/* ── Card ── */}
      <div className="relative w-full max-w-[400px]">

        {/* Logo + Brand */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card p-2.5"
          >
            <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
          </div>

          <div>
            <h1 className="text-2xl text-foreground">
              {i18n.language.startsWith('ar')
                ? 'تسجيل الدخول'
                : i18n.language.startsWith('fr')
                  ? 'Connexion équipe'
                  : 'Team login'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {i18n.language.startsWith('ar')
                ? 'افتح مساحة عملك'
                : i18n.language.startsWith('fr')
                  ? 'Accédez à votre espace de travail'
                  : 'Access your workspace'}
            </p>
          </div>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7"
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12.5px] font-semibold text-foreground/80">
                {t('auth.email')}
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                <Input
                  id="email"
                  type="email"
                  placeholder="utilisateur@usine.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={cn(
                    'h-12 rounded-xl border-border/60 ps-11',
                    'placeholder:text-muted-foreground',
                    'focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/15',
                    'transition-all duration-150',
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12.5px] font-semibold text-foreground/80">
                {t('auth.password')}
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={cn(
                    'h-12 rounded-xl border-border/60 ps-11 pe-12',
                    'placeholder:text-muted-foreground',
                    'focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/15',
                    'transition-all duration-150',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className={cn(
                'mt-2 w-full',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  {t('common.loading')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.login')}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
            {formError && (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError} Vous pouvez corriger les champs et réessayer.
              </p>
            )}
          </form>
        </div>

        {/* Below-card trust line */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/35" />
          <p className="text-xs text-muted-foreground/45">
            {i18n.language.startsWith('ar')
              ? `دخول آمن لفرق ${companyName}`
              : i18n.language.startsWith('fr')
                ? `Connexion sécurisée — ${companyName}`
                : `Secure access · ${companyName}`}
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="absolute bottom-0 inset-x-0 border-t border-border/60 bg-card/60 py-3">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 px-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {companyName}</span>
          <span>v{PRODUCT.version}</span>
        </div>
      </footer>
    </div>
  );
}
