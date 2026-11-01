import { useMemo } from "react";
import { useAlerts } from "@/hooks/useBatches";
import { useAllReceptionLots } from "@/hooks/useStock";
import { useProductionOrders } from "@/hooks/useProduction";
import { useReceptionAlerts, useReceptionsV2 } from "@/hooks/useReceptionsV2";
import { usePhase2Pipeline } from "@/hooks/usePhase2Pipeline";
import { useListStockLotsQuery, useListShipmentsQuery } from "@/store/api/stockApi";
import { usePackagingOrders } from "@/hooks/usePackaging";
import { knownCount, resolveDataCondition, type DataCondition } from "@/lib/dataCondition";
import type { AvailableLot } from "@/hooks/useAvailableLotsForPhase2";

const ACTIVE_BATCH_ALERT_STATUSES = new Set(["active", "ACTIVE"]);

/** Each flag says this role may read that data, so a refused request is never sent. */
type FactoryShellMetricOptions = {
  enableReceptions?: boolean;
  enableReceptionAlerts?: boolean;
  enableReceptionLots?: boolean;
  enableProduction?: boolean;
  enableBatchAlerts?: boolean;
  enablePhase2?: boolean;
  enableStock?: boolean;
  enablePackaging?: boolean;
  enableLogistics?: boolean;
};

type Source = { label: string; enabled: boolean; condition: DataCondition };

const watch = (
  label: string,
  enabled: boolean,
  query: { isLoading?: boolean; error?: unknown },
  data: unknown,
): Source => ({ label, enabled, condition: resolveDataCondition({ isLoading: query.isLoading, error: query.error, data }) });

const sum = (...values: Array<number | null>) =>
  values.some((value) => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);

/**
 * Every figure the shell shows. A figure is null unless the server answered for it: the
 * screens must not read a refusal or a failure as zero, or as nothing to do.
 */
export const useFactoryShellMetrics = (options: FactoryShellMetricOptions = {}) => {
  const enableReceptions = options.enableReceptions ?? false;
  const enableReceptionAlerts = options.enableReceptionAlerts ?? false;
  const enableReceptionLots = options.enableReceptionLots ?? false;
  const enableProduction = options.enableProduction ?? false;
  const enableBatchAlerts = options.enableBatchAlerts ?? false;
  const enablePhase2 = options.enablePhase2 ?? false;
  const enableStock = options.enableStock ?? false;
  const enablePackaging = options.enablePackaging ?? false;
  const enableLogistics = options.enableLogistics ?? false;

  const receptionsQuery = useReceptionsV2({ enabled: enableReceptions });
  const receptionAlertsQuery = useReceptionAlerts({ enabled: enableReceptionAlerts });
  const productionQuery = useProductionOrders({ enabled: enableProduction });
  // Lots réels de l'usine (vue unifiée réception→stock) — remplace l'ancienne
  // collection legacy `batches` dont les compteurs étaient toujours faux.
  const lotsQuery = useAllReceptionLots(undefined, { enabled: enableReceptionLots });
  const batchAlertsQuery = useAlerts({ enabled: enableBatchAlerts });
  const pipeline = usePhase2Pipeline({ enabled: enablePhase2 });

  // RTK Query uses skip, React Query uses enabled
  const pfQuery = useListStockLotsQuery({ category: 'PF' } as any, { skip: !enableStock });
  const packagingQuery = usePackagingOrders(undefined, { enabled: enablePackaging });
  const shipmentsQuery = useListShipmentsQuery(undefined, { skip: !enableLogistics });

  const receptionRows = receptionsQuery.error && receptionsQuery.data.length === 0 ? undefined : receptionsQuery.data;
  const receptionAlerts = receptionAlertsQuery.data as unknown[] | undefined;
  const orders = productionQuery.data as Array<{ status?: string }> | undefined;
  const lots = lotsQuery.currentData as Array<{ stock_status?: string }> | undefined;
  const batchAlerts = batchAlertsQuery.data as Array<{ status?: unknown }> | undefined;
  const pfLots = pfQuery.data as Array<{ status?: string }> | undefined;
  const packagingOrders = packagingQuery.data as Array<{ status?: string }> | undefined;
  const shipments = shipmentsQuery.data as Array<{ status?: string }> | undefined;
  const pipelineData = pipeline.error ? undefined : pipeline.isLoading ? undefined : pipeline.waiting;

  return useMemo(() => {
    const sources = [
      watch("réceptions", enableReceptions, receptionsQuery, receptionRows),
      watch("alertes de réception", enableReceptionAlerts, receptionAlertsQuery, receptionAlerts),
      watch("ordres de fabrication", enableProduction, productionQuery, orders),
      watch("lots", enableReceptionLots, lotsQuery, lots),
      watch("alertes", enableBatchAlerts, batchAlertsQuery, batchAlerts),
      watch("atelier", enablePhase2, pipeline, pipelineData),
      watch("produits finis", enableStock, pfQuery, pfLots),
      watch("conditionnement", enablePackaging, packagingQuery, packagingOrders),
      watch("expéditions", enableLogistics, shipmentsQuery, shipments),
    ];
    const conditionOf = (index: number) => (sources[index].enabled ? sources[index].condition : "restricted" as const);

    const receptionCount = (status: string) =>
      knownCount(conditionOf(0), receptionRows, (rows) => rows.filter((r) => r.status === status).length);

    const draftReceptions = receptionCount("BROUILLON");
    const waitingQcReceptions = receptionCount("EN_ATTENTE_QC");
    const inQcReceptions = receptionCount("EN_QC");
    const releasedReceptions = receptionCount("LIBERE");
    const pendingReceptions = sum(draftReceptions, waitingQcReceptions, inQcReceptions);

    const inProgressOrders = knownCount(conditionOf(2), orders, (rows) => rows.filter((o) => o.status === "in_progress").length);
    // File qualité réelle = réceptions en attente/en cours de QC.
    const qualityLots = sum(waitingQcReceptions, inQcReceptions);
    const quarantinedLots = knownCount(conditionOf(3), lots, (rows) => rows.filter((l) => l.stock_status === "EN_QUARANTAINE").length);
    const storedLots = knownCount(conditionOf(3), lots, (rows) => rows.filter((l) => l.stock_status === "STOCK_LIBERE").length);

    const batchAlertCount = knownCount(conditionOf(4), batchAlerts, (rows) => rows.filter((a) => ACTIVE_BATCH_ALERT_STATUSES.has(String(a.status))).length);
    const receptionAlertCount = enableReceptionAlerts ? knownCount(conditionOf(1), receptionAlerts, (rows) => rows.length) : 0;
    const activeAlertsCount = sum(receptionAlertCount, batchAlertCount);

    const pipelineKnown = ['ready', 'empty', 'stale'].includes(conditionOf(5));
    const phase2Active = pipelineKnown ? pipeline.inFumigation + pipeline.inCleaning + pipeline.inHydration + pipeline.inTriage : null;
    const phase2Waiting = pipelineKnown ? pipeline.waiting.length : null;
    const waitingLots: AvailableLot[] = pipeline.waiting;
    const validatedPFLots = knownCount(conditionOf(6), pfLots, (rows) => rows.filter((l) => l.status === 'VALIDATED').length);
    const activePackagingOrders = knownCount(conditionOf(7), packagingOrders, (rows) => rows.filter((o) => o.status === 'EN_COURS' || o.status === 'PLANIFIE').length);
    const pendingShipments = knownCount(conditionOf(8), shipments, (rows) => rows.filter((s) => s.status === 'PLANNED' || s.status === 'IN_PREPARATION').length);

    const consulted = sources.filter((source) => source.enabled);

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
      coverage: {
        /** Something this role may see is still on its way. */
        loading: consulted.some((source) => source.condition === "loading"),
        /** What could not be checked, in words. "Nothing urgent" may not be said while this has entries. */
        unavailable: consulted
          .filter((source) => ["error", "offline", "restricted", "session", "notFound", "stale"].includes(source.condition))
          .map((source) => source.label),
      },
    };
  }, [
    batchAlerts, batchAlertsQuery, enableBatchAlerts, enableLogistics, enablePackaging, enablePhase2, enableProduction,
    enableReceptionAlerts, enableReceptionLots, enableReceptions, enableStock, lots, lotsQuery, orders, packagingOrders,
    packagingQuery, pfLots, pfQuery, pipeline, pipelineData, productionQuery, receptionAlerts, receptionAlertsQuery,
    receptionRows, receptionsQuery, shipments, shipmentsQuery,
  ]);
};
