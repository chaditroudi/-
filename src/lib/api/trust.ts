import { apiRequest } from '@/integrations/mongodb/client';
import { axiosClient } from '@/lib/axiosClient';

type ApiEnvelope<T> = {
  data: T;
};

export type GoldenThreadLotState = {
  lotId: string;
  valid: boolean;
  eventCount: number;
  tipHash: string | null;
  stage: string | null;
  goldenThreadComplete: boolean;
  progress: {
    current: string | null;
    completed: string[];
    missing: string[];
    percent: number;
    rejected: boolean;
  };
};

export type GoldenThreadSummary = {
  route: string;
  stages: string[];
  totalTracked: number;
  complete: number;
  broken: number;
  inProgress: number;
  lots: GoldenThreadLotState[];
};

export type PassportClaim = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  verified: boolean;
};

export type LotPassport = {
  wave: string;
  lotId: string;
  lotNumber: string;
  brand: string;
  plant: string;
  tipHash: string | null;
  valid: boolean;
  eventCount: number;
  stage: string | null;
  goldenThread: {
    route: string;
    stages: string[];
    progress: GoldenThreadLotState['progress'];
    complete: boolean;
  };
  claims: PassportClaim[];
  verifiedAt: string;
  disclaimer: string;
};

export type RecallDrillResult = {
  wave: string;
  resolvedLotId: string;
  lotNumber: string;
  tipHash: string | null;
  valid: boolean;
  elapsedMs: number;
  under60s: boolean;
  targetSeconds: number;
  stats: {
    nodeCount: number;
    edgeCount: number;
    upstreamCount: number;
    downstreamCount: number;
    shipmentCount: number;
    paletteCount: number;
    stageCount: number;
  };
  upstream: Array<{ id: string; type: string; label: string; sublabel: string | null; status: string | null; column: number }>;
  downstream: Array<{ id: string; type: string; label: string; sublabel: string | null; status: string | null; column: number }>;
  impactedShipments: Array<{ id: string | null; status: string | null; reference: string | null; customer: string | null }>;
  impactedPalettes: Array<{ id: string | null; sscc: string | null; palette_number: string | null; status: string | null }>;
  ranAt: string;
};

export const trustApi = {
  getLotState: async (lotId: string) => {
    const response = await apiRequest<ApiEnvelope<GoldenThreadLotState>>(
      `/trust/lots/${encodeURIComponent(lotId)}/state`,
    );
    return response.data;
  },
  verifyLot: async (lotId: string) => {
    const response = await apiRequest<ApiEnvelope<{ valid: boolean; eventCount: number; tipHash: string | null }>>(
      `/trust/lots/${encodeURIComponent(lotId)}/verify`,
    );
    return response.data;
  },
  getGoldenThread: async () => {
    const response = await apiRequest<ApiEnvelope<GoldenThreadSummary>>('/trust/golden-thread');
    return response.data;
  },
  /** Public — no session required. */
  getPassport: async (lotId: string) => {
    const response = await axiosClient.get<ApiEnvelope<LotPassport>>(
      `/trust/lots/${encodeURIComponent(lotId)}/passport`,
    );
    return response.data.data;
  },
  runRecall: async (query: { lotId?: string; lotNumber?: string; sscc?: string }) => {
    const response = await apiRequest<ApiEnvelope<RecallDrillResult>>('/trust/recall', {
      method: 'POST',
      body: JSON.stringify(query),
    });
    return response.data;
  },
};
