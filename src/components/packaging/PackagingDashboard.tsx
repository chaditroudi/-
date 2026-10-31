import { useState } from 'react';
import { usePackagingKpis, usePackagingOrders } from '@/hooks/usePackaging';
import { PackagingOrderPanel } from './orders/PackagingOrderPanel';
import { BOMPanel } from './bom/BOMPanel';
import { LabelTemplatePanel } from './labels/LabelTemplatePanel';
import { PalettePanel } from './palettes/PalettePanel';
import { printPackagingDailyReport } from './printPackagingDailyReport';
import { printPfLotLabel } from '@/lib/printPfLotLabel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardList, Package, Tag, Layers, AlertTriangle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/useBranding';
import { useSiteSettings } from '@/hooks/useSettings';

interface Props {
  currentUser?: string;
}

export function PackagingDashboard({ currentUser = 'Utilisateur' }: Props) {
  const [tab, setTab] = useState('orders');
  const [quickPfOpen, setQuickPfOpen] = useState(false);
  const [quickLotNumber, setQuickLotNumber] = useState('');
  const { data: kpis } = usePackagingKpis();
  const { data: orders = [] } = usePackagingOrders();
  const { companyName } = useBranding();
  const { data: siteSettings } = useSiteSettings();

  const metalDetectionOrders = orders.filter(
    (o) => o.status === 'EN_COURS' && o.metal_detector_failures > 0,
  ).length;

  const gs1Prefix = siteSettings?.documents?.gs1_company_prefix || '09999999';
  const gs1Placeholder = gs1Prefix === '09999999';

  const handlePrintPfLabel = () => {
    if (!quickLotNumber.trim()) {
      toast.error('Veuillez saisir un numéro de lot PF');
      return;
    }
    printPfLotLabel({
      lotNumber: quickLotNumber.trim(),
      productName: 'Dattes — Produit fini',
      grade: 'PF',
      companyName,
      plantName: siteSettings?.plant_name,
    });
    toast.success(`Étiquette imprimée pour le lot ${quickLotNumber.trim()}`);
    setQuickPfOpen(false);
    setQuickLotNumber('');
  };

  return (
    <div className="space-y-4">
      {gs1Placeholder && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Étiquettes SSCC provisoires</p>
            <p className="text-xs opacity-90">
              Préfixe GS1 = 09999999 (placeholder). Paramètres → Documents → préfixe société GS1,
              puis adhésion GS1 Tunisie.
            </p>
          </div>
        </div>
      )}
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setQuickPfOpen(true)}
        >
          <Tag className="h-3.5 w-3.5" />
          Étiquette PF rapide
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => printPackagingDailyReport(orders, kpis ?? null)}
        >
          <Printer className="h-3.5 w-3.5" />
          Rapport journalier
        </Button>
      </div>

      {/* Critical banner */}
      {metalDetectionOrders > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-red-700 text-sm font-semibold animate-pulse">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {metalDetectionOrders} ordre(s) avec détection métal — arrêt immédiat requis
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="orders" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            OF Conditionnement
            {(kpis?.active_orders ?? 0) > 0 && (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-xs bg-blue-500 text-white">
                {kpis!.active_orders}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bom" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Nomenclatures
          </TabsTrigger>
          <TabsTrigger value="labels" className="gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Étiquettes
          </TabsTrigger>
          <TabsTrigger value="palettes" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Palettes
            {(kpis?.palettes_sealed_today ?? 0) > 0 && (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-xs bg-green-600 text-white">
                {kpis!.palettes_sealed_today}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <PackagingOrderPanel currentUser={currentUser} />
        </TabsContent>
        <TabsContent value="bom" className="mt-4">
          <BOMPanel currentUser={currentUser} />
        </TabsContent>
        <TabsContent value="labels" className="mt-4">
          <LabelTemplatePanel currentUser={currentUser} />
        </TabsContent>
        <TabsContent value="palettes" className="mt-4">
          <PalettePanel currentUser={currentUser} />
        </TabsContent>
      </Tabs>

      {/* Quick PF Label Dialog (Replaces former window.prompt) */}
      <Dialog open={quickPfOpen} onOpenChange={setQuickPfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Impression d'étiquette Produit Fini (PF)
            </DialogTitle>
            <DialogDescription>
              Saisissez ou scannez le numéro de lot pour imprimer immédiatement l'étiquette conforme avec code-barres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pf-lot-input">Numéro de lot PF</Label>
              <Input
                id="pf-lot-input"
                placeholder="ex. PF-2026-001"
                value={quickLotNumber}
                onChange={(e) => setQuickLotNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePrintPfLabel();
                  }
                }}
                autoFocus
              />
            </div>
            {orders.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Lots récents en conditionnement :</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {orders.slice(0, 5).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setQuickLotNumber(o.order_number)}
                      className="text-xs font-mono bg-muted hover:bg-muted/80 px-2 py-1 rounded-md text-foreground transition-colors border"
                    >
                      {o.order_number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setQuickPfOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handlePrintPfLabel} disabled={!quickLotNumber.trim()}>
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimer l'étiquette
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
