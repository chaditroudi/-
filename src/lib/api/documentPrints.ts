import { apiRequest } from '@/integrations/mongodb/client';
import type { DocumentPrint, DocumentType } from '@/types/documentPrints';

type Env<T> = { data: T };

export const documentPrintsApi = {
  get: async (source_id: string, document_type: DocumentType): Promise<DocumentPrint | null> => {
    const qs = new URLSearchParams({ source_id, document_type });
    const r = await apiRequest<Env<DocumentPrint | null>>(`/document-prints?${qs}`);
    return r.data ?? null;
  },

  upsert: async (payload: Omit<DocumentPrint, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentPrint> => {
    const r = await apiRequest<Env<DocumentPrint>>('/document-prints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return r.data;
  },

  update: async (id: string, payload: Partial<DocumentPrint>): Promise<DocumentPrint> => {
    const r = await apiRequest<Env<DocumentPrint>>(`/document-prints/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return r.data;
  },
};
