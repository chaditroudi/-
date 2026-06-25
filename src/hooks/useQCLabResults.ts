import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qualityExtApi } from '@/lib/api/quality-ext';
import { receptionsExtApi } from '@/lib/api/receptions';
import { applyRetroactiveLabBlock } from '@/lib/phase1RuleEngine';
import type { LabAnalysisResult } from '@/types/reception';
import { toast } from 'sonner';

export interface SubmitLabResultsInput {
  inspectionId: string;
  receptionId: string;
  receptionNumber: string;
  supplierId: string;
  supplierName: string;
  enteredBy: string;
  results: Omit<LabAnalysisResult, 'entered_at' | 'entered_by'>[];
}

export const useSubmitLabResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitLabResultsInput) => {
      const now = new Date().toISOString();
      const stamped: LabAnalysisResult[] = input.results.map((r) => ({
        ...r,
        entered_at: now,
        entered_by: input.enteredBy || null,
      }));

      await receptionsExtApi.updateQcInspection(input.inspectionId, {
        lab_analysis_results: stamped,
        updated_at: now,
      });

      const ncResults = stamped.filter((r) => !r.conformant);
      if (ncResults.length > 0) {
        const findings = ncResults
          .map((r) => `${r.analysis_type}: ${r.result_value}${r.threshold ? ` (seuil: ${r.threshold})` : ''}`)
          .join('; ');
        await applyRetroactiveLabBlock({
          receptionId: input.receptionId,
          receptionNumber: input.receptionNumber,
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          labFindings: findings,
        });
      }

      return { nonConformantCount: ncResults.length };
    },
    onSuccess: ({ nonConformantCount }, variables) => {
      queryClient.invalidateQueries({ queryKey: ['qc-inspections', variables.receptionId] });
      queryClient.invalidateQueries({ queryKey: ['receptions-v2'] });
      queryClient.invalidateQueries({ queryKey: ['reception-v2', variables.receptionId] });
      if (nonConformantCount > 0) {
        toast.error(
          `RG-Q07 — ${nonConformantCount} analyse(s) non conforme(s). Lot bloqué automatiquement.`,
        );
      } else {
        toast.success('Résultats laboratoire enregistrés — toutes les analyses sont conformes.');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erreur enregistrement résultats labo');
      console.error(error);
    },
  });
};
