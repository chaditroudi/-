import { apiRequest } from '@/integrations/mongodb/client';

type ApiEnvelope<T> = {
  data: T;
};

export type SageOperationsData = {
  flow: {
    pendingDa: number;
    poPendingInternalApproval: number;
    poReadyToSend: number;
    poSubmitted: number;
    poConfirmed: number;
    poPartiallyDelivered: number;
    poDelivered: number;
    receptionsWaitingQc: number;
    receptionsBlocked: number;
    quarantineLots: number;
    rejectedLots: number;
    productionInProgress: number;
    productionDelayed: number;
    quarantinedStockLots: number;
  };
  compliance: {
    traceabilityCoverage: number;
    threeWayCoverage: number;
    threeWayMatched: number;
    threeWayMismatch: number;
  };
  blockers: Array<{
    key: string;
    label: string;
    count: number;
    tab: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  last_updated_at: string;
};

export const analyticsApi = {
  getSageOperations: async () => {
    const response = await apiRequest<ApiEnvelope<SageOperationsData>>('/analytics/sage-operations');
    return response.data;
  },
};
