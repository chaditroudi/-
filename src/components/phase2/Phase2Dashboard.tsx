import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FumigationPanel } from './fumigation/FumigationPanel';
import { NettoyagePanel } from './nettoyage/NettoyagePanel';
import { HydratationPanel } from './hydratation/HydratationPanel';
import { TriagePanel } from './triage/TriagePanel';
import { Phase2AlertsPanel } from './alerts/Phase2AlertsPanel';
import { LotTraceabilityDialog } from './LotTraceabilityDialog';
import { ProductionPipelinePanel } from '@/components/production/ProductionPipelinePanel';
import { usePhase2AlertKpis } from '@/hooks/usePhase2Alerts';
import { usePhase2Pipeline } from '@/hooks/usePhase2Pipeline';
import { useFumigationCycles } from '@/hooks/useFumigation';
import { useCleaningCycles } from '@/hooks/useNettoyage';
import { useHydrationCycles } from '@/hooks/useHydratation';
import { useTriageSessions } from '@/hooks/useTriage';
import { printPhase2DailyReport } from './printPhase2DailyReport';
import { Flame, Droplets, Wind, Scissors, Bell, Search, Printer, GitMerge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';

interface Props {
  currentUser?: string;
  defaultModule?: 'fumigation' | 'nettoyage' | 'hydratation' | 'triage' | 'alertes' | 'pipeline';
  preSelectedLot?: string;
}

export function Phase2Dashboard({ currentUser = 'Utilisateur', defaultModule = 'fumigation', preSelectedLot }: Props) {
  const kpis = usePhase2AlertKpis();
  const pipeline = usePhase2Pipeline();
  const [traceabilityLot, setTraceabilityLot] = useState(preSelectedLot ?? '');
  const [traceabilityOpen, setTraceabilityOpen] = useState(!!preSelectedLot);
  const [traceabilityQuery, setTraceabilityQuery] = useState(preSelectedLot ?? '');
  const [activeModule, setActiveModule] = useState(defaultModule);

  const { data: allFum = [] } = useFumigationCycles();
  const { data: allNet = [] } = useCleaningCycles();
  const { data: allHyd = [] } = useHydrationCycles();
  const { data: allTri = [] } = useTriageSessions();

  const openTraceability = () => {
    setTraceabilityQuery(traceabilityLot.trim());
    setTraceabilityOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">Traitement & Préparation — Phase 2</h2>
        {pipeline.waiting.length > 0 && (
          <button
            onClick={() => setActiveModule('pipeline')}
            className="min-h-[36px] rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-200"
          >
            {pipeline.waiting.length} lot(s) en attente Phase 1 →
          </button>
        )}
        {(kpis.urgence > 0 || kpis.critique > 0) && (
          <span className="animate-pulse rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {kpis.urgence + kpis.critique} alerte(s) critique(s)
          </span>
        )}
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => printPhase2DailyReport({ fumigation: allFum, cleaning: allNet, hydration: allHyd, triage: allTri })}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Rapport J
          </Button>
          <div className="flex flex-1 gap-1.5 sm:flex-none">
            <Input
              placeholder="N° lot…"
              value={traceabilityLot}
              onChange={(e) => setTraceabilityLot(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && traceabilityLot && openTraceability()}
              className="h-9 w-full sm:w-40"
            />
            <Button size="sm" variant="outline" className="px-2.5" onClick={openTraceability} disabled={!traceabilityLot.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as typeof defaultModule)}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:max-w-3xl">
          <TabsTrigger value="pipeline" className="relative shrink-0 gap-1.5">
            <GitMerge className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pipeline</span>
            {pipeline.waiting.length > 0 && (
              <span className="ml-1 text-[11px] bg-amber-100 text-amber-700 rounded-full px-1 py-0.5 leading-none">
                {pipeline.waiting.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fumigation" className="shrink-0 gap-1.5">
            <Flame className="h-3.5 w-3.5" />
            Fumigation
          </TabsTrigger>
          <TabsTrigger value="nettoyage" className="shrink-0 gap-1.5">
            <Droplets className="h-3.5 w-3.5" />
            Nettoyage
          </TabsTrigger>
          <TabsTrigger value="hydratation" className="shrink-0 gap-1.5">
            <Wind className="h-3.5 w-3.5" />
            Hydratation
          </TabsTrigger>
          <TabsTrigger value="triage" className="shrink-0 gap-1.5">
            <Scissors className="h-3.5 w-3.5" />
            Triage
          </TabsTrigger>
          <TabsTrigger value="alertes" className="relative shrink-0 gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Alertes
            {kpis.total > 0 && (
              <span className="ml-1 text-[11px] bg-red-100 text-red-700 rounded-full px-1 leading-none py-0.5">
                {kpis.total}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <ProductionPipelinePanel
            onLaunchFumigation={(lot: AvailableLot) => {
              setActiveModule('fumigation');
              setTraceabilityLot(lot.reception_number);
            }}
          />
        </TabsContent>

        <TabsContent value="fumigation">
          <FumigationPanel currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="nettoyage">
          <NettoyagePanel currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="hydratation">
          <HydratationPanel currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="triage">
          <TriagePanel currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="alertes">
          <Phase2AlertsPanel />
        </TabsContent>
      </Tabs>

      <LotTraceabilityDialog
        open={traceabilityOpen}
        onOpenChange={setTraceabilityOpen}
        lotNumber={traceabilityQuery}
      />
    </div>
  );
}
