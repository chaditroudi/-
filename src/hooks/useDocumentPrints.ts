import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentPrintsApi } from '@/lib/api/documentPrints';
import type { DocumentPrint, DocumentType } from '@/types/documentPrints';

export const useDocumentPrint = (source_id: string, document_type: DocumentType) =>
  useQuery({
    queryKey: ['document-prints', source_id, document_type],
    queryFn: () => documentPrintsApi.get(source_id, document_type),
    enabled: !!source_id,
  });

export const useSaveDocumentPrint = (source_id: string, document_type: DocumentType) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<DocumentPrint, 'id' | 'created_at' | 'updated_at'>) =>
      documentPrintsApi.upsert(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-prints', source_id, document_type] });
      toast.success('Document sauvegardé');
    },
    onError: () => toast.error('Erreur sauvegarde'),
  });
};

export const useUpdateDocumentPrint = (source_id: string, document_type: DocumentType) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<DocumentPrint>) =>
      documentPrintsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-prints', source_id, document_type] });
    },
    onError: () => toast.error('Erreur mise à jour document'),
  });
};
