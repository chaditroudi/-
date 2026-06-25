import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Factory,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import heroBannerImage from '@/assets/hero-banner-dates.jpg';
import EcodatteLogo from '@/assets/EcodatteLogo.png';
import royalPalmLogo from '@/assets/logo-royal-palm.png';

const getAuthCopy = (language: string) => {
  if (language.startsWith('fr')) {
    return {
      badge: 'Espace securise',
      title: 'Pilotez la production',
      titleAccent: 'sans friction.',
      subtitle:
        "Accedez aux receptions, aux ordres de production et aux alertes qualite depuis une interface plus claire pour l'usine.",
      highlights: [
        'Visibilite en temps reel sur les receptions et blocages',
        'Acces rapide aux modules production, stock et qualite',
        'Permissions adaptees au role de chaque equipe',
      ],
      stats: [
        { value: '24/7', label: 'suivi des operations' },
        { value: 'Role', label: 'acces securise' },
        { value: 'Live', label: 'alertes critiques' },
      ],
      loginTitle: 'Connexion equipe',
      loginDescription: 'Retrouvez votre espace de travail et vos priorites.',
      passwordHint: 'Minimum 6 caracteres.',
      loginHelper: 'Connexion securisee pour les equipes Royal Palm Dates.',
      footer: 'Royal Palm Dates Group',
      footerTagline: 'Systeme de gestion de production',
      forgotPassword: 'Mot de passe oublie?',
      version: 'v2.0',
    };
  }

  if (language.startsWith('ar')) {
    return {
      badge: 'مساحة آمنة',
      title: 'ادخل إلى نظام الإنتاج',
      titleAccent: 'بسرعة ووضوح.',
      subtitle:
        'تابع الاستقبال والإنتاج والتنبيهات من واجهة أكثر وضوحاً ومناسبة لفرق المصنع.',
      highlights: [
        'رؤية مباشرة لحالة الاستقبال والتنبيهات',
        'وصول سريع إلى وحدات الإنتاج والمخزون والجودة',
        'صلاحيات مناسبة لكل دور داخل المؤسسة',
      ],
      stats: [
        { value: '24/7', label: 'متابعة العمليات' },
        { value: 'Role', label: 'وصول آمن' },
        { value: 'Live', label: 'تنبيهات فورية' },
      ],
      loginTitle: 'تسجيل الدخول',
      loginDescription: 'افتح مساحة العمل الخاصة بك وتابع أولوياتك.',
      passwordHint: 'ستة أحرف على الأقل.',
      loginHelper: 'دخول آمن لفرق Royal Palm Dates.',
      footer: 'Royal Palm Dates Group',
      footerTagline: 'نظام إدارة الإنتاج',
      forgotPassword: 'نسيت كلمة المرور؟',
      version: 'v2.0',
    };
  }

  return {
    badge: 'Secure workspace',
    title: 'Run production with',
    titleAccent: 'total clarity.',
    subtitle:
      'Access receptions, production orders, stock, and quality alerts from a sharper entry point built for factory teams.',
    highlights: [
      'Real-time visibility on receptions and blockers',
      'Faster access to production, stock, and quality modules',
      'Role-based permissions for every team member',
    ],
    stats: [
      { value: '24/7', label: 'operations visibility' },
      { value: 'Role', label: 'secure access' },
      { value: 'Live', label: 'critical alerts' },
    ],
    loginTitle: 'Team login',
    loginDescription: 'Return to your workspace and current priorities.',
    passwordHint: 'Minimum 6 characters.',
    loginHelper: 'Secure access for Royal Palm Dates teams.',
    footer: 'Royal Palm Dates Group',
    footerTagline: 'Manufacturing Execution System',
    forgotPassword: 'Forgot password?',
    version: 'v2.0',
  };
};

const inputCls =
  'h-11 rounded-xl border-border/60 bg-background/60 ps-11 pe-11 text-sm text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-colors';

const FormField = ({
  htmlFor,
  label,
  icon: Icon,
  children,
  helper,
  helperClassName,
}: {
  htmlFor: string;
  label: string;
  icon: typeof Mail;
  children: React.ReactNode;
  helper?: string;
  helperClassName?: string;
}) => (
  <div className="space-y-2">
    <Label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/80">
      {label}
    </Label>
    <div className="relative">
      <Icon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
      {children}
    </div>
    {helper && (
      <p className={`text-[11px] leading-relaxed ${helperClassName ?? 'text-muted-foreground/70'}`}>{helper}</p>
    )}
  </div>
);

export default function Auth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, isLoading: isAuthLoading } = useAuthContext();

  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const authCopy = getAuthCopy(i18n.language);

  useEffect(() => {
    if (!isAuthLoading && user) {
      navigate('/');
    }
  }, [user, isAuthLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginPending(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast({ title: t('messages.saveSuccess'), description: t('home.welcome') });
      navigate('/');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('messages.loadError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoginPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/8 bg-sidebar/95 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-5 sm:px-8">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <img src={EcodatteLogo} alt="Ecodatte" className="h-5 w-auto brightness-[100] invert" />
            </div>
            <div className="hidden sm:block h-5 w-px bg-white/15" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[13px] font-semibold tracking-tight text-white/90">Royal Palm</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                Dates Group
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 sm:flex">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-[11px] font-semibold tracking-wide text-emerald-300">
                {authCopy.badge}
              </span>
            </div>
            <div className="rounded-xl border border-white/12 bg-white/8 p-0.5">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 pt-16">

        {/* ── HERO SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] flex-col overflow-hidden bg-sidebar lg:flex lg:w-[50%] xl:w-[55%]">

          {/* Background texture */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
            style={{ backgroundImage: `url(${heroBannerImage})` }}
          />

          {/* Gradient layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#061510]/95 via-[#0b2218]/85 to-[#123322]/75" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#061510] to-transparent" />

          {/* Decorative blobs */}
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/12 blur-3xl" />
          <div className="absolute -left-16 bottom-16 h-64 w-64 rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute right-12 bottom-32 h-40 w-40 rounded-full bg-amber-400/8 blur-2xl" />

          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Content */}
          <div className="relative flex h-full flex-col justify-between p-8 xl:p-12">

            {/* Top: logo + headline */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <img
                  src={royalPalmLogo}
                  alt="Royal Palm"
                  className="h-10 w-10 rounded-xl object-cover opacity-90 ring-1 ring-white/15"
                />
                <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  MES {authCopy.version}
                </span>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    {authCopy.footerTagline}
                  </span>
                </div>

                <h1 className="max-w-sm text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
                  {authCopy.title}{' '}
                  <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                    {authCopy.titleAccent}
                  </span>
                </h1>

                <p className="max-w-sm text-sm leading-relaxed text-white/55">
                  {authCopy.subtitle}
                </p>
              </div>

              {/* Feature list */}
              <div className="space-y-3">
                {authCopy.highlights.map((item, i) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3 backdrop-blur-sm"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-white/68">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: stats */}
            <div className="grid grid-cols-3 gap-3">
              {authCopy.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4 backdrop-blur-sm"
                >
                  <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── FORM PANEL ───────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-4 py-10 sm:px-8 lg:justify-center">

          {/* Subtle dot pattern background */}
          <div
            className="pointer-events-none fixed inset-0 opacity-[0.3] lg:start-[50%] xl:start-[55%]"
            style={{
              backgroundImage:
                'radial-gradient(circle, hsl(142 30% 82%) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          <div className="relative w-full max-w-[440px]">

            {/* Card header above card */}
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary shadow-sm">
                <Factory className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {authCopy.loginTitle}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {authCopy.loginDescription}
              </p>
            </div>

            {/* Main card — login only */}
            <div className="overflow-hidden rounded-[1.75rem] border border-border/50 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]">
              <div className="p-5 sm:p-6">
                <form onSubmit={handleLogin} className="space-y-4">

                  <FormField htmlFor="login-email" label={t('auth.email')} icon={Mail}>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="user@royalpalm.tn"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={inputCls}
                      required
                      autoComplete="email"
                    />
                  </FormField>

                  <FormField htmlFor="login-password" label={t('auth.password')} icon={Lock}>
                    <Input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className={inputCls}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </FormField>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-[14px] font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 hover:shadow-primary/35"
                    disabled={isLoginPending}
                  >
                    {isLoginPending ? t('common.loading') : t('auth.login')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <p className="text-center text-[11px] text-muted-foreground/60">
                    {authCopy.loginHelper}
                  </p>
                </form>
              </div>
            </div>

            {/* Below-card hint (mobile: show secure badge) */}
            <div className="mt-5 flex items-center justify-center gap-2 text-center">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/50" />
              <p className="text-[11px] text-muted-foreground/50">{authCopy.badge}</p>
            </div>
          </div>
        </main>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/40 bg-white/60 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-5 text-center sm:flex-row sm:flex-wrap sm:gap-3 sm:px-8 sm:text-left">
          <div className="flex items-center gap-2.5">
            <img src={EcodatteLogo} alt="Ecodatte" className="h-4 w-auto opacity-40" />
            <span className="text-[12px] text-muted-foreground/60">
              © {new Date().getFullYear()} {authCopy.footer}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground/50">
            <span>{authCopy.footerTagline}</span>
            <span className="hidden h-3 w-px bg-border/50 sm:block" />
            <span className="font-medium text-primary/60">{authCopy.version}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
