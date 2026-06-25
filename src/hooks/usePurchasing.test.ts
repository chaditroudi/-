import { describe, expect, it } from 'vitest';

import type { PurchaseOrder } from '@/types/purchasing';

import { matchesPurchaseOrderStatusFilter, mergePurchaseOrderIntoList } from './usePurchasing';

const makeOrder = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: overrides.id || 'po-1',
  order_number: overrides.order_number || 'BC-20260615-0001',
  supplier_id: overrides.supplier_id || 'sup-1',
  requisition_id: overrides.requisition_id ?? null,
  status: overrides.status || 'draft',
  order_date: overrides.order_date || '2026-06-15',
  expected_delivery_date: overrides.expected_delivery_date ?? null,
  actual_delivery_date: overrides.actual_delivery_date ?? null,
  delivered_at: overrides.delivered_at ?? null,
  subtotal: overrides.subtotal ?? 100,
  tax_amount: overrides.tax_amount ?? 0,
  total_amount: overrides.total_amount ?? 100,
  currency: overrides.currency || 'TND',
  payment_terms: overrides.payment_terms ?? null,
  delivery_address: overrides.delivery_address ?? null,
  delivery_site: overrides.delivery_site ?? null,
  incoterm: overrides.incoterm ?? null,
  supplier_reference: overrides.supplier_reference ?? null,
  notes: overrides.notes ?? null,
  created_by: overrides.created_by ?? 'user-1',
  buyer_name: overrides.buyer_name ?? 'Buyer',
  approval_required: overrides.approval_required ?? false,
  approval_threshold: overrides.approval_threshold ?? 50000,
  approved_by: overrides.approved_by ?? null,
  approved_at: overrides.approved_at ?? null,
  submitted_at: overrides.submitted_at ?? null,
  sent_at: overrides.sent_at ?? null,
  confirmed_at: overrides.confirmed_at ?? null,
  order_type: overrides.order_type ?? null,
  variety: overrides.variety ?? null,
  quality_expected: overrides.quality_expected ?? null,
  bio_required: overrides.bio_required ?? false,
  tolerance_pct: overrides.tolerance_pct ?? null,
  advance_paid: overrides.advance_paid ?? null,
  transport_mode: overrides.transport_mode ?? null,
  payment_status: overrides.payment_status ?? null,
  supplier_confirmed_at: overrides.supplier_confirmed_at ?? null,
  invoiced_at: overrides.invoiced_at ?? null,
  invoice_number: overrides.invoice_number ?? null,
  invoice_date: overrides.invoice_date ?? null,
  invoice_amount: overrides.invoice_amount ?? null,
  invoice_status: overrides.invoice_status ?? 'not_invoiced',
  receipt_status: overrides.receipt_status ?? 'not_received',
  matching_status: overrides.matching_status ?? 'pending',
  goods_receipt_count: overrides.goods_receipt_count ?? 0,
  line_count: overrides.line_count ?? 1,
  created_at: overrides.created_at || '2026-06-15T08:00:00.000Z',
  updated_at: overrides.updated_at || '2026-06-15T08:00:00.000Z',
  supplier: overrides.supplier,
  requisition: overrides.requisition,
  lines: overrides.lines ?? [],
});

describe('usePurchasing cache helpers', () => {
  it('inserts a newly created order at the top of the list', () => {
    const existing = makeOrder({
      id: 'po-older',
      order_number: 'BC-20260614-0001',
      created_at: '2026-06-14T08:00:00.000Z',
    });
    const created = makeOrder({
      id: 'po-new',
      order_number: 'BC-20260615-0002',
      created_at: '2026-06-15T09:00:00.000Z',
    });

    const merged = mergePurchaseOrderIntoList([existing], created);

    expect(merged.map((order) => order.id)).toEqual(['po-new', 'po-older']);
  });

  it('replaces an existing cached order without duplicating it', () => {
    const cached = makeOrder({
      id: 'po-1',
      order_number: 'BC-20260615-0001',
      total_amount: 100,
    });
    const updated = makeOrder({
      id: 'po-1',
      order_number: 'BC-20260615-0001',
      total_amount: 250,
      updated_at: '2026-06-15T10:00:00.000Z',
    });

    const merged = mergePurchaseOrderIntoList([cached], updated);

    expect(merged).toHaveLength(1);
    expect(merged[0].total_amount).toBe(250);
  });

  it('matches status-filtered caches with normalized statuses', () => {
    const draftOrder = makeOrder({ status: 'draft' });
    const submittedOrder = makeOrder({ status: 'submitted' });

    expect(matchesPurchaseOrderStatusFilter(draftOrder, undefined)).toBe(true);
    expect(matchesPurchaseOrderStatusFilter(draftOrder, 'draft')).toBe(true);
    expect(matchesPurchaseOrderStatusFilter(submittedOrder, 'draft')).toBe(false);
  });
});
