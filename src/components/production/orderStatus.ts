import type { ProductionOrderStatus } from '@/types/production';

export const ORDER_STATUS_BADGE: Record<ProductionOrderStatus, string> = {
  draft: 'border-gray-300 bg-gray-100 text-gray-800',
  planned: 'border-blue-300 bg-blue-100 text-blue-900',
  in_progress: 'border-amber-300 bg-amber-100 text-amber-900',
  completed: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  cancelled: 'border-red-300 bg-red-100 text-red-900',
};

/** Urgent first, then the oldest planned start. */
export const byUrgency = <T extends { priority: number; planned_start_date: string | null; created_at: string }>(left: T, right: T) =>
  right.priority - left.priority
  || new Date(left.planned_start_date ?? left.created_at).getTime() - new Date(right.planned_start_date ?? right.created_at).getTime();
