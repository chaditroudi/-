import type { QCChecklistItem } from '@/types/reception';

export type QcChecklistAnswers = Record<string, 'CONFORME' | 'NON_CONFORME'>;

export const checklistResults = (items: QCChecklistItem[], answers: QcChecklistAnswers) =>
  items
    .filter((item) => answers[item.id])
    .map((item) => ({
      checklist_item_id: item.id,
      check_code: item.code,
      check_name: item.name,
      severity: item.severity,
      result: answers[item.id],
    }));

export const unansweredCount = (items: QCChecklistItem[], answers: QcChecklistAnswers) =>
  items.filter((item) => !answers[item.id]).length;

export const hasNonConformity = (items: QCChecklistItem[], answers: QcChecklistAnswers) =>
  items.some((item) => answers[item.id] === 'NON_CONFORME');
