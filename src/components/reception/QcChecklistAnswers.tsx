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
    <div className="divide-y" data-testid="qc-checklist">
      <p className="pb-1.5 text-xs text-muted-foreground">{checklist.name}, version {checklist.version}. Répondez à chaque contrôle.</p>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5">
          <span className="text-sm leading-tight">
            {item.name}
            {item.severity === 'CRITIQUE' && <Badge variant="destructive" className="ml-1.5 align-text-bottom">Critique</Badge>}
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
