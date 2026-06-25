import { useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { useSubmitLabResults } from "@/hooks/useQCLabResults";
import type { QCInspection } from "@/types/reception";
import type { ReceptionV2 } from "@/types/reception";
import { useAuth } from "@/hooks/useAuth";

interface LabResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection: QCInspection;
  reception: Pick<ReceptionV2, "id" | "reception_number" | "supplier_id" | "supplier_name_snapshot" | "supplier">;
}

interface DraftResult {
  analysis_type: string;
  result_value: string;
  threshold: string;
  conformant: boolean;
  notes: string;
}

export const LabResultsDialog = ({
  open,
  onOpenChange,
  inspection,
  reception,
}: LabResultsDialogProps) => {
  const { user } = useAuth();
  const submitLabResults = useSubmitLabResults();

  const analyses: string[] = inspection.lab_analyses ?? [];

  const [drafts, setDrafts] = useState<DraftResult[]>(() =>
    analyses.map((a) => ({
      analysis_type: a,
      result_value: "",
      threshold: getDefaultThreshold(a),
      conformant: true,
      notes: "",
    })),
  );

  const updateDraft = (index: number, field: keyof DraftResult, value: string | boolean) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const canSubmit = drafts.every((d) => d.result_value.trim().length > 0);

  const handleSubmit = async () => {
    await submitLabResults.mutateAsync({
      inspectionId: inspection.id,
      receptionId: reception.id,
      receptionNumber: reception.reception_number,
      supplierId: reception.supplier_id,
      supplierName:
        reception.supplier?.name ?? reception.supplier_name_snapshot ?? reception.supplier_id,
      enteredBy: user?.email ?? user?.id ?? "inconnu",
      results: drafts.map((d) => ({
        analysis_type: d.analysis_type,
        result_value: d.result_value.trim(),
        threshold: d.threshold.trim() || null,
        conformant: d.conformant,
        notes: d.notes.trim() || null,
      })),
    });
    onOpenChange(false);
  };

  const ncCount = drafts.filter((d) => !d.conformant).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Résultats laboratoire — {reception.reception_number}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground px-1">
          Inspection {inspection.inspection_number} — Échantillon prélevé par{" "}
          {inspection.inspector_name}
          {inspection.lab_storage_location && (
            <span> · Emplacement: {inspection.lab_storage_location}</span>
          )}
        </div>

        {inspection.lab_analysis_results && inspection.lab_analysis_results.length > 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Résultats déjà enregistrés le{" "}
            {new Date(inspection.lab_analysis_results[0].entered_at).toLocaleDateString("fr-FR")}.
            Soumettez à nouveau pour mettre à jour.
          </div>
        ) : null}

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3 p-1">
            {drafts.map((draft, i) => (
              <Card
                key={draft.analysis_type}
                className={draft.conformant ? "border-border" : "border-red-200 bg-red-50/40"}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{draft.analysis_type}</span>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={draft.conformant}
                        onCheckedChange={(v) => updateDraft(i, "conformant", Boolean(v))}
                      />
                      <span className={draft.conformant ? "text-emerald-700" : "text-red-700"}>
                        {draft.conformant ? "Conforme" : "Non conforme"}
                      </span>
                      {draft.conformant ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Valeur mesurée *</Label>
                      <Input
                        value={draft.result_value}
                        onChange={(e) => updateDraft(i, "result_value", e.target.value)}
                        placeholder={getPlaceholder(draft.analysis_type)}
                        className={!draft.result_value.trim() ? "border-amber-300" : ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Seuil réglementaire</Label>
                      <Input
                        value={draft.threshold}
                        onChange={(e) => updateDraft(i, "threshold", e.target.value)}
                        placeholder="ex: < 10 µg/kg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={draft.notes}
                      onChange={(e) => updateDraft(i, "notes", e.target.value)}
                      placeholder="Observations, méthode d'analyse..."
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {ncCount > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>RG-Q07</strong> — {ncCount} analyse(s) non conforme(s). La validation
              bloquera automatiquement le lot.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitLabResults.isPending}
            variant={ncCount > 0 ? "destructive" : "default"}
          >
            {submitLabResults.isPending
              ? "Enregistrement..."
              : ncCount > 0
              ? `Enregistrer (${ncCount} NC — blocage RG-Q07)`
              : "Enregistrer les résultats"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function getDefaultThreshold(analysisType: string): string {
  const map: Record<string, string> = {
    Pesticides: "< 0.01 mg/kg",
    "Métaux lourds": "< 0.1 mg/kg Pb",
    Aflatoxines: "< 10 µg/kg",
    Microbiologie: "< 100 UFC/g",
  };
  return map[analysisType] ?? "";
}

function getPlaceholder(analysisType: string): string {
  const map: Record<string, string> = {
    Pesticides: "ex: 0.005 mg/kg",
    "Métaux lourds": "ex: 0.03 mg/kg",
    Aflatoxines: "ex: 4.2 µg/kg",
    Microbiologie: "ex: 12 UFC/g",
  };
  return map[analysisType] ?? "Valeur mesurée";
}

// Named export for index barrel
export type { LabResultsDialogProps };
