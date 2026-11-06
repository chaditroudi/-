import { Progress } from '@/components/ui/progress';
import type { Supplier } from '@/types/mes';
import {
  computeSupplierScoreM1,
  getSupplierScoreGradeLabel,
  hasSupplierScoreData,
} from '@/lib/royalPalmPhase1';

interface SupplierScorePanelProps {
  supplier: Partial<Supplier>;
  compact?: boolean;
}

const gradeClass = (grade: 'excellent' | 'good' | 'watch' | 'risk') =>
  ({
    excellent: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    good: 'bg-sky-50 border-sky-200 text-sky-800',
    watch: 'bg-amber-50 border-amber-200 text-amber-800',
    risk: 'bg-red-50 border-red-200 text-red-800',
  })[grade];

export const SupplierScorePanel = ({ supplier, compact = false }: SupplierScorePanelProps) => {
  if (!hasSupplierScoreData(supplier)) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-center">
        <p className="text-sm font-medium">Score indisponible</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Le score usine apparaît après au moins une réception clôturée avec QC.
        </p>
      </div>
    );
  }

  const score = computeSupplierScoreM1(supplier);
  const criteria = [
    { label: 'Qualité lots', score: score.qualityScore, weight: 40 },
    { label: 'Taux de rejet', score: score.rejectionScore, weight: 20 },
    { label: 'Quantités', score: score.quantityScore, weight: 15 },
    { label: 'Ponctualité', score: score.punctualityScore, weight: 15 },
    { label: 'Documents', score: score.documentScore, weight: 10 },
  ];

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border px-4 py-4 text-center ${gradeClass(score.grade)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Score usine M1</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{score.finalScore.toFixed(0)}</p>
        <p className="text-sm">{getSupplierScoreGradeLabel(score.grade)}</p>
        {score.autoBlockTriggered && (
          <p className="mt-2 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            RG-F03 — taux de rejet &gt; 20 %
          </p>
        )}
      </div>

      {!compact && (
        <div className="space-y-2.5">
          {criteria.map((criterion) => (
            <div key={criterion.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>
                  {criterion.label}
                  <span className="ms-1 text-muted-foreground">({criterion.weight} %)</span>
                </span>
                <span className="font-medium tabular-nums">{criterion.score.toFixed(0)}</span>
              </div>
              <Progress value={criterion.score} className="h-1.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
