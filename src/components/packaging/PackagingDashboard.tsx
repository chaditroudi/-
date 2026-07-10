import { useState } from 'react';
import { usePackagingKpis, usePackagingOrders } from '@/hooks/usePackaging';
import { PackagingOrderPanel } from './orders/PackagingOrderPanel';
import { BOMPanel } from './bom/BOMPanel';
import { LabelTemplatePanel } from './labels/LabelTemplatePanel';
import { PalettePanel } from './palettes/PalettePanel';
import { printPackagingDailyReport } from './printPackagingDailyReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Package, Tag, Layers, AlertTriangle, Printer } from 'lucide-react';

interface Props {
  currentUser?: string;
}

export function PackagingDashboard({ currentUser = 'Utilisateur' }: Props) {
  const [tab, setTab] = useState('orders');
  const { data: kpis } = usePackagingKpis();
  const { data: orders = [] } = usePackagingOrders();

  const metalDetectionOrders = orders.filter(
    (o) => o.status === 'EN_COURS' && o.metal_detector_failures > 0,
  ).length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1" />
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
        <TabsList className="h-9 flex flex-wrap gap-0">
          <TabsTrigger value="orders" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            OF Conditionnement
            {(kpis?.active_orders ?? 0) > 0 && (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-[11px] bg-blue-500 text-white">
                {kpis!.active_orders}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bom" className="text-xs gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Nomenclatures
          </TabsTrigger>
          <TabsTrigger value="labels" className="text-xs gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Étiquettes
          </TabsTrigger>
          <TabsTrigger value="palettes" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Palettes
            {(kpis?.palettes_sealed_today ?? 0) > 0 && (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-[11px] bg-green-600 text-white">
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
    </div>
  );
}
