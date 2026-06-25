import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type SageOperationsData } from '@/lib/api/analytics';

export const useSageOperations = () => {
  return useQuery({
    queryKey: ['sage-operations'],
    queryFn: async (): Promise<SageOperationsData> => analyticsApi.getSageOperations(),
    refetchInterval: 30000,
  });
};
