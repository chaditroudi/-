import { useEffect, useState } from 'react';
import { useUpdateSiteSettings } from '@/hooks/useSettings';
import type { SiteSettings } from '@/types/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  settings: SiteSettings;
}

export function DocumentsPanel({ settings }: Props) {
  const update = useUpdateSiteSettings();
  const [documents, setDocuments] = useState({ ...settings.documents });

  useEffect(() => {
    setDocuments({ ...settings.documents });
  }, [settings]);

  const setField = (key: keyof typeof documents, value: string | number | boolean) => {
    setDocuments((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await update.mutateAsync({
      documents: {
        ...documents,
        numbering_padding: Number(documents.numbering_padding || 5),
        certificate_signatory: documents.certificate_signatory || null,
        report_footer: documents.report_footer || null,
        gs1_company_prefix: String(documents.gs1_company_prefix || '09999999').replace(/\D/g, '') || '09999999',
      },
    });
    toast.success('Paramètres documents & numérotation mis à jour');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Préfixes documentaires</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Réception</Label>
            <Input value={documents.reception_prefix} onChange={(e) => setField('reception_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bon de commande</Label>
            <Input value={documents.purchase_order_prefix} onChange={(e) => setField('purchase_order_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordre fabrication</Label>
            <Input value={documents.production_order_prefix} onChange={(e) => setField('production_order_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ordre conditionnement</Label>
            <Input value={documents.packaging_order_prefix} onChange={(e) => setField('packaging_order_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expédition</Label>
            <Input value={documents.shipment_prefix} onChange={(e) => setField('shipment_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Palette</Label>
            <Input value={documents.pallet_prefix} onChange={(e) => setField('pallet_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lot</Label>
            <Input value={documents.lot_prefix} onChange={(e) => setField('lot_prefix', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Padding séquence</Label>
            <Input
              type="number"
              min={3}
              max={10}
              value={documents.numbering_padding}
              onChange={(e) => setField('numbering_padding', Number(e.target.value || 5))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Impression & certificats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Langue d’impression</Label>
              <Select value={documents.print_language} onValueChange={(value) => setField('print_language', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Signataire certificats</Label>
              <Input
                value={documents.certificate_signatory ?? ''}
                onChange={(e) => setField('certificate_signatory', e.target.value)}
                placeholder="Responsable qualité / direction"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            Afficher le logo sur les impressions
            <Switch
              checked={documents.show_logo_on_prints}
              onCheckedChange={(checked) => setField('show_logo_on_prints', checked)}
            />
          </label>

          <div className="space-y-1.5">
            <Label className="text-xs">Pied de page imprimé</Label>
            <Textarea
              value={documents.report_footer ?? ''}
              onChange={(e) => setField('report_footer', e.target.value)}
              rows={3}
              placeholder="Texte légal, certification, contact ou note qualité..."
            />
          </div>

          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
            <Label className="text-xs">Préfixe société GS1 (SSCC)</Label>
            <Input
              value={documents.gs1_company_prefix ?? '09999999'}
              onChange={(e) => setField('gs1_company_prefix', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="09999999"
              className="font-mono"
            />
            <p className="text-[11px] text-amber-900/80">
              {String(documents.gs1_company_prefix || '09999999') === '09999999'
                ? 'Placeholder — non conforme retail. Remplacer après adhésion GS1 Tunisie.'
                : 'Préfixe configuré — vérifier auprès de GS1 Tunisie avant production retail.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer documents & numérotation
      </Button>
    </div>
  );
}
