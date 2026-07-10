import { useEffect, useState } from 'react';
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

  const isRTL = i18n.language.startsWith('ar');

  useEffect(() => {
    if (!isAuthLoading && user) navigate('/');
  }, [user, isAuthLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await signIn(email, password);
      toast({ title: t('messages.saveSuccess'), description: t('home.welcome') });
      navigate('/');
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err.message || t('messages.loadError'),
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F4F6F9] px-4 py-10"
    >
      {/* ── Subtle background blobs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-emerald-300/6 blur-3xl" />
      </div>

      {/* ── Language switcher ── */}
      <div className="absolute end-4 top-4 z-10">
        <div className="rounded-xl border border-border/60 bg-white/80 p-0.5 backdrop-blur-sm shadow-xs">
          <LanguageSwitcher />
        </div>
      </div>

      {/* ── Card ── */}
      <div className="relative w-full max-w-[400px]">

        {/* Logo + Brand */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/18 bg-white p-2.5"
            style={{ boxShadow: '0 0 0 6px hsl(142 68% 27% / 0.07), 0 8px 24px -8px hsl(142 68% 27% / 0.25)' }}
          >
            <BrandLogo className="h-full w-full" imgClassName="h-full w-full object-contain" alt={companyName} />
          </div>

          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/7 px-3 py-0.5">
              <ShieldCheck className="h-3 w-3 text-primary/70" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/65">
                {companyShortName} · MES
              </span>
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">
              {i18n.language.startsWith('ar')
                ? 'تسجيل الدخول'
                : i18n.language.startsWith('fr')
                  ? 'Connexion équipe'
                  : 'Team login'}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground/70">
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
          className="rounded-2xl border border-border/60 bg-white p-6 sm:p-7"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 20px 48px -16px rgba(0,0,0,0.12)' }}
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
                  placeholder="user@royalpalm.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={cn(
                    'h-12 rounded-xl border-border/60 ps-11',
                    'placeholder:text-muted-foreground/40',
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
                    'placeholder:text-muted-foreground/40',
                    'focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/15',
                    'transition-all duration-150',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-muted-foreground/50 transition-colors hover:bg-muted/60 hover:text-foreground"
                  aria-label={showPwd ? 'Hide' : 'Show'}
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
                'mt-2 h-12 w-full rounded-xl text-[15px] font-semibold',
                'bg-gradient-to-r from-primary to-emerald-500',
                'shadow-[0_4px_16px_-4px_hsl(142_68%_27%_/_0.45)]',
                'hover:opacity-92 hover:shadow-[0_6px_20px_-4px_hsl(142_68%_27%_/_0.55)]',
                'transition-all duration-200',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t('common.loading')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.login')}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
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
      <footer className="absolute bottom-0 inset-x-0 border-t border-border/30 bg-white/50 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 px-5 text-[11px] text-muted-foreground/40">
          <span>© {new Date().getFullYear()} {companyName}</span>
          <span className="hidden sm:inline">Manufacturing Execution System</span>
          <span className="rounded-full border border-primary/16 bg-primary/5 px-2 py-0.5 font-bold tracking-wide text-primary/50">
            v2.0
          </span>
        </div>
      </footer>
    </div>
  );
}
