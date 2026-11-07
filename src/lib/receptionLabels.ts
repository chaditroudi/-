import { useTranslation } from 'react-i18next';
import { getQcClassificationLabel, type QcScoreBreakdown } from '@/lib/royalPalmPhase1';
import type { ReceptionNextStep } from '@/lib/receptionWorkflow';
import { describeWeighingSource, weighingSourceKey } from '@/lib/receptionIntake';
import {
  qcDecisionLabels,
  receptionStatusLabels,
  stockStatusLabels,
  type QCDecisionType,
  type ReceptionHeaderStatus,
  type StockLotStatus,
} from '@/types/reception';

/**
 * Reception codes in the reader's language. Stored codes never change; the French maps in
 * `types/reception` and `lib/receptionWorkflow` stay the fallback, so French reads exactly as before.
 */
export function useReceptionLabels() {
  const { t } = useTranslation();
  return {
    receptionStatus: (code: ReceptionHeaderStatus) => t(`receptionStatus.${code}`, { defaultValue: receptionStatusLabels[code] ?? code }),
    stockStatus: (code: StockLotStatus) => t(`stockStatus.${code}`, { defaultValue: stockStatusLabels[code] ?? code }),
    qcDecided: (code: QCDecisionType) => t(`qcDecided.${code}`, { defaultValue: qcDecisionLabels[code] ?? code }),
    qcGrade: (code: QcScoreBreakdown['classification']) => t(`qcGrade.${code}`, { defaultValue: getQcClassificationLabel(code) ?? code }),
    weighingSource: (source?: string | null, verifiedDevice?: boolean | null) =>
      t(`weighingSource.${weighingSourceKey(source, verifiedDevice)}`, { defaultValue: describeWeighingSource(source, verifiedDevice) }),
    nextStep: (step: ReceptionNextStep) => ({
      title: t(`receptionNext.${step.key}.title`, { n: step.count, defaultValue: step.title }),
      description: t(`receptionNext.${step.key}.description`, { defaultValue: step.description }),
      actionLabel: step.actionLabel ? t(`receptionNext.${step.key}.action`, { defaultValue: step.actionLabel }) : null,
    }),
  };
}
