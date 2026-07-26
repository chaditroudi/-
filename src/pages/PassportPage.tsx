import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trustApi } from '@/lib/api/trust';
import { BadgeCheck, ShieldAlert, Leaf } from 'lucide-react';

const formatValue = (value: string | number | boolean | null) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value);
};

export default function PassportPage() {
  const { lotId = '' } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-passport', lotId],
    queryFn: () => trustApi.getPassport(lotId),
    enabled: Boolean(lotId),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f7f5] flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">Vérification du passeport lot…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#f4f7f5] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border bg-white p-6 space-y-3">
          <p className="font-semibold text-red-700">Passeport introuvable</p>
          <p className="text-sm text-slate-600">
            {error instanceof Error ? error.message : `Aucun lot pour « ${lotId} ».`}
          </p>
          <Link to="/auth" className="text-sm text-emerald-800 underline">
            Accès usine
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3ef] text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-900 text-emerald-50 px-3 py-1 text-xs font-medium">
            <Leaf className="h-3.5 w-3.5" />
            Passeport digital acheteur
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{data.brand}</h1>
          <p className="text-slate-600">
            {data.plant} · Lot <span className="font-mono font-semibold">{data.lotNumber}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                data.valid ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-800'
              }`}
            >
              {data.valid ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {data.valid ? 'Chaîne hash vérifiée' : 'Chaîne compromise'}
            </span>
            <span className="inline-flex rounded-full bg-white border px-3 py-1 text-xs font-medium">
              Fil d'or {data.goldenThread.progress.percent}%
              {data.goldenThread.complete ? ' · Complet' : ''}
            </span>
            {(() => {
              const ccpSensor = data.claims.find((c) => c.key === 'ccp_sensor_verified');
              const coldIntact = data.claims.find((c) => c.key === 'cold_chain_intact');
              return (
                <>
                  {ccpSensor && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        ccpSensor.verified
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {ccpSensor.verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      CCP capteurs {ccpSensor.verified ? 'vérifiés' : 'non ancrés'}
                    </span>
                  )}
                  {coldIntact && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        coldIntact.verified
                          ? 'bg-sky-100 text-sky-900'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {coldIntact.verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      Froid {coldIntact.verified ? 'intact' : 'excursion'}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </header>

        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Claims vérifiables</h2>
          <div className="divide-y">
            {data.claims
              .filter((claim) => claim.key !== 'tip_hash')
              .map((claim) => (
                <div key={claim.key} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{claim.label}</p>
                    <p className="text-sm text-slate-700 mt-0.5">{formatValue(claim.value)}</p>
                  </div>
                  <span className={`text-[11px] font-semibold ${claim.verified ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {claim.verified ? 'Ancré' : 'Non ancré'}
                  </span>
                </div>
              ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Empreinte tip</h2>
          <p className="font-mono text-xs break-all text-slate-700">{data.tipHash || '—'}</p>
          <p className="text-xs text-slate-500">{data.disclaimer}</p>
          <p className="text-[11px] text-slate-400">Vérifié le {new Date(data.verifiedAt).toLocaleString('fr-TN')}</p>
        </section>
      </div>
    </div>
  );
}
