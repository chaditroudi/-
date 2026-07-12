import { useMemo } from "react";
import { useAlerts } from "@/hooks/useBatches";
import { useAllReceptionLots } from "@/hooks/useStock";
import { useProductionOrders } from "@/hooks/useProduction";
import { useReceptionAlerts, useReceptionsV2 } from "@/hooks/useReceptionsV2";
import { usePhase2Pipeline } from "@/hooks/usePhase2Pipeline";
import { useListStockLotsQuery, useListShipmentsQuery } from "@/store/api/stockApi";
import { usePackagingOrders } from "@/hooks/usePackaging";
import type { AvailableLot } from "@/hooks/useAvailableLotsForPhase2";

const ACTIVE_BATCH_ALERT_STATUSES = new Set(["active", "ACTIVE"]);

type FactoryShellMetricOptions = {
  enableReceptions?: boolean;
  enableReceptionAlerts?: boolean;
  enableProduction?: boolean;
  enableBatches?: boolean;
  enableBatchAlerts?: boolean;
  enablePhase2?: boolean;
  enableStock?: boolean;
  enablePackaging?: boolean;
  enableLogistics?: boolean;
};

export const useFactoryShellMetrics = (options?: FactoryShellMetricOptions) => {
  const enablePhase2 = options?.enablePhase2 ?? false;
  const enableStock = options?.enableStock ?? false;
  const enablePackaging = options?.enablePackaging ?? false;
  const enableLogistics = options?.enableLogistics ?? false;

  const { data: receptions = [] } = useReceptionsV2({ enabled: options?.enableReceptions ?? true });
  const { data: receptionAlerts = [] } = useReceptionAlerts({ enabled: options?.enableReceptionAlerts ?? true });
  const { data: productionOrders = [] } = useProductionOrders({ enabled: options?.enableProduction ?? true });
  // Lots réels de l'usine (vue unifiée réception→stock) — remplace l'ancienne
  // collection legacy `batches` dont les compteurs étaient toujours faux.
  const { data: receptionLots = [] } = useAllReceptionLots();
  const { data: batchAlerts = [] } = useAlerts({ enabled: options?.enableBatchAlerts ?? true });
  const pipeline = usePhase2Pipeline({ enabled: enablePhase2 });

  // RTK Query uses skip, React Query uses enabled
  const { data: rawPfLots } = useListStockLotsQuery({ category: 'PF' } as any, { skip: !enableStock });
  const pfLots = (rawPfLots as unknown as any[] | undefined) ?? [];

  const { data: packagingOrders = [] } = usePackagingOrders(undefined, { enabled: enablePackaging });

  const { data: rawShipments } = useListShipmentsQuery(undefined, { skip: !enableLogistics });
  const shipments = (rawShipments as unknown as any[] | undefined) ?? [];

  return useMemo(() => {
    const draftReceptions = receptions.filter((r) => r.status === "BROUILLON").length;
    const waitingQcReceptions = receptions.filter((r) => r.status === "EN_ATTENTE_QC").length;
    const inQcReceptions = receptions.filter((r) => r.status === "EN_QC").length;
    const releasedReceptions = receptions.filter((r) => r.status === "LIBERE").length;
    const pendingReceptions = draftReceptions + waitingQcReceptions + inQcReceptions;

    const inProgressOrders = productionOrders.filter((o) => o.status === "in_progress").length;
    // File qualité réelle = réceptions en attente/en cours de QC.
    const qualityLots = waitingQcReceptions + inQcReceptions;
    const quarantinedLots = receptionLots.filter((l) => l.stock_status === "EN_QUARANTAINE").length;
    const storedLots = receptionLots.filter((l) => l.stock_status === "STOCK_LIBERE").length;
    const activeAlertsCount =
      receptionAlerts.length +
      batchAlerts.filter((a) => ACTIVE_BATCH_ALERT_STATUSES.has(String(a.status))).length;

    const phase2Active = pipeline.inFumigation + pipeline.inCleaning + pipeline.inHydration + pipeline.inTriage;
    const phase2Waiting = pipeline.waiting.length;
    const waitingLots: AvailableLot[] = pipeline.waiting;
    const validatedPFLots = pfLots.filter((l: any) => l.status === 'VALIDATED').length;
    const activePackagingOrders = packagingOrders.filter((o: any) => o.status === 'EN_COURS' || o.status === 'PLANIFIE').length;
    const pendingShipments = shipments.filter((s: any) => s.status === 'PLANNED' || s.status === 'IN_PREPARATION').length;

    return {
      draftReceptions,
      waitingQcReceptions,
      inQcReceptions,
      releasedReceptions,
      pendingReceptions,
      inProgressOrders,
      qualityLots,
      quarantinedLots,
      storedLots,
      activeAlertsCount,
      phase2Active,
      phase2Waiting,
      waitingLots,
      validatedPFLots,
      activePackagingOrders,
      pendingShipments,
    };
  }, [batchAlerts, receptionLots, productionOrders, receptionAlerts, receptions, pipeline, pfLots, packagingOrders, shipments]);
};
