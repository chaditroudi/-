import { apiRequest } from '@/integrations/mongodb/client';

export type ScanResolution = {
  scanToken: string;
  expiresAt: string;
  kind: string;
  stockLot: Record<string, unknown> | null;
  location: Record<string, unknown> | null;
  receptionLotId: string | null;
};

export const scanApi = {
  resolve: async (rawValue: string, scannerKind = 'CAMERA') => {
    const response = await apiRequest<{ data: ScanResolution }>('/trust/scan/resolve', {
      method: 'POST',
      body: JSON.stringify({ rawValue, scannerKind }),
    });
    return response.data;
  },
};
