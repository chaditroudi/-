import { describe, expect, it } from 'vitest';
import {
  computeSupplierScoreM1,
  hasSupplierScoreData,
  isReceivableSupplier,
} from './royalPalmPhase1';

describe('supplier score helpers', () => {
  it('marks empty farmers as score unavailable', () => {
    expect(hasSupplierScoreData({ name: 'Nouveau', quality_score: 0, delivered_lots_count: 0 })).toBe(false);
  });

  it('uses M1 only when operational facts exist', () => {
    const supplier = {
      quality_score: 90,
      rejection_rate: 5,
      delivery_reliability_score: 88,
      traceability_score: 92,
      delivered_lots_count: 4,
    };
    expect(hasSupplierScoreData(supplier)).toBe(true);
    expect(computeSupplierScoreM1(supplier).grade).toBe('excellent');
  });

  it('only allows active suppliers for reception / PO pickers', () => {
    expect(isReceivableSupplier({ is_active: true, supplier_status: 'active' })).toBe(true);
    expect(isReceivableSupplier({ is_active: true, supplier_status: 'pending_approval' })).toBe(false);
    expect(isReceivableSupplier({ is_active: false, supplier_status: 'active' })).toBe(false);
  });
});
