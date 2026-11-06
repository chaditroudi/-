import { describe, expect, it } from 'vitest';
import { formatMeasurement } from './analyticsPresentation';

describe('analytics measurement presentation', () => {
  it.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY])('does not turn missing or invalid evidence into zero (%s)', value => {
    expect(formatMeasurement(value, true, '%')).toBe('Non mesuré');
  });
  it.each([0, 95, 100])('withholds legacy defaults and unsupported estimates (%s)', value => {
    expect(formatMeasurement(value, false, '%')).toBe('Non mesuré');
  });
  it('preserves a measured zero instead of confusing it with absence', () => {
    expect(formatMeasurement(0, true, '%')).toBe('0.0%');
  });
  it('formats a value only when its measurement basis is available', () => {
    expect(formatMeasurement(12.345, true, ' TND', 2)).toBe('12.35 TND');
  });
});
