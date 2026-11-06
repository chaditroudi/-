/** Presentation only: no industrial calculation or record is changed here. */
export function formatMeasurement(
  value: number | null | undefined,
  hasBasis: boolean | undefined,
  unit = '',
  precision = 1,
): string {
  if (!hasBasis || value == null || !Number.isFinite(value)) return 'Non mesuré';
  return `${value.toFixed(precision)}${unit}`;
}
