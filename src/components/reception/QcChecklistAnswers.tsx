import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { QcChecklistAnswers as Answers } from '@/lib/qcChecklist';
import type { QCChecklist, QCChecklistItem } from '@/types/reception';

interface QcChecklistAnswersProps {
  checklist: QCChecklist | null;
  items: QCChecklistItem[];
  unavailable: boolean;
  answers: Answers;
  onChange: (answers: Answers) => void;
}

/** The published checklist, answered by the inspector: nothing here is prefilled. */
export function QcChecklistAnswers({ checklist, items, unavailable, answers, onChange }: QcChecklistAnswersProps) {
  if (unavailable) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        Aucune grille qualité publiée pour ce type de réception : la libération est impossible.
      </p>
    );
  }
  if (!checklist) return null;

  return (
    <div className="space-y-2" data-testid="qc-checklist">
      <p className="text-xs text-muted-foreground">{checklist.name} · version {checklist.version}</p>
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
          <span className="flex items-center gap-2 text-sm">
            {item.name}
            {item.severity === 'CRITIQUE' && <Badge variant="destructive">Critique</Badge>}
          </span>
          <span className="flex gap-1">
            {(['CONFORME', 'NON_CONFORME'] as const).map((result) => (
              <Button
                key={result}
                type="button"
                size="sm"
                aria-label={`${item.name} : ${result === 'CONFORME' ? 'conforme' : 'non conforme'}`}
                aria-pressed={answers[item.id] === result}
                variant={answers[item.id] === result ? (result === 'CONFORME' ? 'default' : 'destructive') : 'outline'}
                onClick={() => onChange({ ...answers, [item.id]: result })}
              >
                {result === 'CONFORME' ? 'Conforme' : 'Non conforme'}
              </Button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
