import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLotSuggestions } from './useStock';

const shipmentMutation = vi.hoisted(() => vi.fn(() => ({ unwrap: () => Promise.resolve({}) })));
vi.mock('@/store/api/stockApi', async importOriginal => ({
  ...await importOriginal<typeof import('@/store/api/stockApi')>(),
  useGetExpeditionLotSuggestionsMutation: () => [shipmentMutation, { isLoading: false }],
}));
afterEach(() => vi.clearAllMocks());

describe('lot suggestions are a read capability', () => {
  it('does not invoke shipment mutation when a product or quantity changes', () => {
    const { result, rerender } = renderHook(({ productId, quantity }) => useLotSuggestions(productId, quantity), {
      initialProps: { productId: 'synthetic-product-1', quantity: 100 },
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toMatch(/indisponibles/);
    rerender({ productId: 'synthetic-product-2', quantity: 200 });
    expect(shipmentMutation).not.toHaveBeenCalled();
  });
  it('does not claim a populated or successful suggestion list before selection', () => {
    const { result } = renderHook(() => useLotSuggestions('', 0));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(shipmentMutation).not.toHaveBeenCalled();
  });
});
