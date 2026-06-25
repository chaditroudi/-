import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import type { SiteCode } from '@/types/p2p';
import { SITE_LABELS } from '@/types/p2p';
import { toast } from 'sonner';

interface Props {
  settings: SiteSettings;
}

const SITE_CODES = Object.keys(SITE_LABELS) as SiteCode[];
const cloneP2PSettings = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function P2PSettingsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [p2p, setP2P] = useState(cloneP2PSettings(settings.p2p));

  useEffect(() => {
    setP2P(cloneP2PSettings(settings.p2p));
  }, [settings]);

  const setP2PField = (
    key: keyof typeof p2p,
    value: boolean | number | typeof p2p.approval_matrix | typeof p2p.sites,
  ) => {
    setP2P((prev) => ({ ...prev, [key]: value }));
  };

  const updateApprovalThreshold = (index: number, value: number) => {
    setP2P((prev) => ({
      ...prev,
      approval_matrix: prev.approval_matrix.map((step, stepIndex) =>
        stepIndex === index ? { ...step, threshold_gte: value } : step,
      ),
    }));
  };

  const updateSiteRule = (
    site: SiteCode,
    key: keyof (typeof p2p.sites)[SiteCode],
    value: boolean | number[] | string,
  ) => {
    setP2P((prev) => ({
      ...prev,
      sites: {
        ...prev.sites,
        [site]: {
          ...prev.sites[site],
          [key]: value,
        },
      },
    }));
  };

  const updateSiteAlertDay = (site: SiteCode, index: number, value: number) => {
    const current = p2p.sites[site].cert_alert_days;
    const next = [...current];
    next[index] = value;
    updateSiteRule(site, 'cert_alert_days', next);
  };

  const handleSave = async () => {
    await update.mutateAsync({
      p2p: {
        ...p2p,
        rfq_minimum_quote_count: Number(p2p.rfq_minimum_quote_count || 0),
        rfq_quote_threshold_tnd: Number(p2p.rfq_quote_threshold_tnd || 0),
        default_invoice_tolerance_pct: Number(p2p.default_invoice_tolerance_pct || 0),
        approval_matrix: [...p2p.approval_matrix].sort((a, b) => a.threshold_gte - b.threshold_gte),
        sites: Object.fromEntries(
          SITE_CODES.map((site) => [
            site,
            {
              ...p2p.sites[site],
              cert_alert_days: p2p.sites[site].cert_alert_days.map((value) => Number(value || 0)),
            },
          ]),
        ) as typeof p2p.sites,
      },
    });
    toast.success('Règles P2P mises à jour');
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Règles globales P2P</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Mise en concurrence active
              <Switch
                checked={p2p.enable_minimum_quotes_rule}
                onCheckedChange={(checked) => setP2PField('enable_minimum_quotes_rule', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              BC requis pour BR P2P
              <Switch
                checked={p2p.require_purchase_order_for_goods_receipt}
                onCheckedChange={(checked) => setP2PField('require_purchase_order_for_goods_receipt', checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              BR requis avant bon à payer
              <Switch
                checked={p2p.require_goods_receipt_for_payment}
                onCheckedChange={(checked) => setP2PField('require_goods_receipt_for_payment', checked)}
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre minimum de devis</Label>
              <Input
                type="number"
                min={1}
                value={p2p.rfq_minimum_quote_count}
                onChange={(e) => setP2PField('rfq_minimum_quote_count', Number(e.target.value || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Seuil RFQ (TND)</Label>
              <Input
                type="number"
                min={0}
                value={p2p.rfq_quote_threshold_tnd}
                onChange={(e) => setP2PField('rfq_quote_threshold_tnd', Number(e.target.value || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tolérance facture par défaut (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={p2p.default_invoice_tolerance_pct}
                onChange={(e) => setP2PField('default_invoice_tolerance_pct', Number(e.target.value || 0))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Matrice d'approbation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {p2p.approval_matrix.map((step, index) => (
            <div key={step.level} className="rounded-xl border p-4 space-y-2">
              <div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.level}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seuil minimum (TND)</Label>
                <Input
                  type="number"
                  min={0}
                  value={step.threshold_gte}
                  onChange={(e) => updateApprovalThreshold(index, Number(e.target.value || 0))}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {SITE_CODES.map((site) => {
          const rule = p2p.sites[site];
          return (
            <Card key={site}>
              <CardHeader>
                <CardTitle className="text-sm">{SITE_LABELS[site]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    Certificat bio requis
                    <Switch
                      checked={rule.bio_certification_required}
                      onCheckedChange={(checked) => updateSiteRule(site, 'bio_certification_required', checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    Document phyto requis
                    <Switch
                      checked={rule.phytosanitary_required}
                      onCheckedChange={(checked) => updateSiteRule(site, 'phytosanitary_required', checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    Traçabilité lot stricte
                    <Switch
                      checked={rule.lot_traceability_required}
                      onCheckedChange={(checked) => updateSiteRule(site, 'lot_traceability_required', checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    DLUO/DDM requise
                    <Switch
                      checked={rule.dluo_required}
                      onCheckedChange={(checked) => updateSiteRule(site, 'dluo_required', checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    FDS requise
                    <Switch
                      checked={rule.fds_required}
                      onCheckedChange={(checked) => updateSiteRule(site, 'fds_required', checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    Quarantaine systématique
                    <Switch
                      checked={rule.systematic_quarantine}
                      onCheckedChange={(checked) => updateSiteRule(site, 'systematic_quarantine', checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    Achats devises
                    <Switch
                      checked={rule.forex_enabled}
                      onCheckedChange={(checked) => updateSiteRule(site, 'forex_enabled', checked)}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alerte J-60</Label>
                    <Input
                      type="number"
                      min={1}
                      value={rule.cert_alert_days[0] ?? 60}
                      onChange={(e) => updateSiteAlertDay(site, 0, Number(e.target.value || 0))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alerte J-30</Label>
                    <Input
                      type="number"
                      min={1}
                      value={rule.cert_alert_days[1] ?? 30}
                      onChange={(e) => updateSiteAlertDay(site, 1, Number(e.target.value || 0))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer règles P2P
      </Button>
    </div>
  );
}
