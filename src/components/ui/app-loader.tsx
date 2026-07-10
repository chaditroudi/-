import { Database, Factory, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLoaderProps {
  className?: string;
  title?: string;
  subtitle?: string;
}

const statusItems = [
  { label: 'Session', icon: ShieldCheck },
  { label: 'Droits', icon: Sparkles },
  { label: 'Données', icon: Database },
];

export function AppLoader({
  className,
  title = 'Préparation de votre espace',
  subtitle = "Connexion sécurisée, chargement des accès et synchronisation de l'atelier.",
}: AppLoaderProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(160deg,_#f7f5ef_0%,_#ecf8f2_45%,_#f5efe4_100%)] px-6 py-10 text-slate-900',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-10%] h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-[-6%] top-[12%] h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[18%] h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:88px_88px] opacity-50" />
      </div>

      <div className="animate-page-enter relative z-10 w-full max-w-3xl">
        <div className="glass-panel overflow-hidden rounded-[28px] border-white/70 bg-white/78 p-4 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/85 p-6 sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 badge-pulse" />
                  Date Harvest Hub
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
                    {subtitle}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {statusItems.map(({ label, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)]"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Icon className="h-4 w-4 text-emerald-600" />
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
                  <div className="absolute inset-0 rounded-full border border-emerald-200/80 bg-white/55 shadow-inner" />
                  <div className="absolute inset-3 rounded-full border border-dashed border-emerald-400/50 animate-spin [animation-duration:12s]" />
                  <div className="absolute inset-8 rounded-full border border-slate-200/80" />
                  <div className="absolute inset-11 rounded-full bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.95),_rgba(209,250,229,0.92)_38%,_rgba(16,185,129,0.18)_100%)]" />
                  <div className="absolute right-10 top-9 h-3.5 w-3.5 rounded-full bg-amber-300 shadow-[0_0_22px_rgba(252,211,77,0.95)] animate-pulse" />
                  <div className="absolute bottom-10 left-11 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.75)] animate-pulse" />

                  <div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] bg-slate-950 text-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.8)]">
                    <Factory className="h-11 w-11" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Initialisation en cours
              </div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Secure factory workspace
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
