/**
 * Verified Tunisian Darija glosses for worker-facing primary actions.
 *
 * Strategy (see docs/plans/TUNISIAN_DARIJA_STRATEGY.md):
 * - Do NOT ship a separate incomplete `tn` locale.
 * - FR remains the system-of-record UI language on the floor.
 * - AR (MSA) covers full locale parity for bilingual screens.
 * - Darija appears only as secondary tooltips (`title`) on verified actions.
 *
 * Only add terms confirmed with Tunisian factory workers / supervisors.
 * Prefer Maghrebi Arabic script; Latin transcription only when workers use it orally.
 */
export const WORKER_DARIJA: Record<string, string> = {
  // Reception
  'reception.validate': 'سجّل الاستلام',
  'reception.startQc': 'ابدأ الكنترول',
  'reception.saveDraft': 'احفظ المسودّة',

  // QC
  'qc.continue': 'كمّل',
  'qc.back': 'ارجع',
  'qc.accept': 'اقبل',
  'qc.reject': 'ارفض',
  'qc.quarantine': 'حجر',

  // Production stages
  'production.start': 'ابدأ',
  'production.finish': 'كمّل المرحلة',
  'production.done': 'تمّ',

  // Shared
  'common.confirm': 'أكّد',
  'common.cancel': 'الغي',
  'common.retry': 'عاود',
};

/** Secondary Darija tooltip for a verified action key; undefined if not verified. */
export function darijaTitle(actionKey: string): string | undefined {
  return WORKER_DARIJA[actionKey];
}
