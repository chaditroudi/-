import { useCallback, useState } from 'react';

/**
 * Adds React-Query-style `mutate` + `variables` on top of async RTK wrappers
 * so existing call sites keep button loading states without rewriting every screen.
 */
export function useMutateCompat<TArg, TResult>(
  mutateAsyncImpl: (arg: TArg) => Promise<TResult>,
  isPending: boolean,
  extra: Record<string, unknown> = {},
) {
  const [variables, setVariables] = useState<TArg | undefined>(undefined);

  const mutateAsync = useCallback(
    async (arg: TArg) => {
      setVariables(arg);
      try {
        return await mutateAsyncImpl(arg);
      } finally {
        /* keep last variables for loading-button comparisons */
      }
    },
    [mutateAsyncImpl],
  );

  const mutate = useCallback(
    (arg: TArg) => {
      void mutateAsync(arg);
    },
    [mutateAsync],
  );

  return {
    ...extra,
    mutateAsync,
    mutate,
    variables,
    isPending,
  };
}
