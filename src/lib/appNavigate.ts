/**
 * Shared navigation options for Parcours → module deep-links.
 * Keeps department tools; just opens the right sub-view.
 */
export type AppNavigateOptions = {
  /** Prefill purchase order id when opening receptions (legacy 2nd arg). */
  prefillPOId?: string;
  /** Lot number / id to preselect in the target module. */
  lot?: string;
  /** Sub-view inside the tab (e.g. production: phase2). */
  view?: string;
  /** Phase2 module: fumigation | triage | … */
  module?: string;
  /** Purchasing focus: settlements */
  focus?: string;
};

export type AppNavigateFn = (tab: string, options?: AppNavigateOptions | string) => void;

export const normalizeNavigateOptions = (
  options?: AppNavigateOptions | string,
): AppNavigateOptions => {
  if (typeof options === 'string') return { prefillPOId: options };
  return options || {};
};
