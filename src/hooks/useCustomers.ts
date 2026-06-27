import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api/customers';
import type { Customer } from '@/types/customer';

const QK = {
  list:   (activeOnly?: boolean) => ['customers', 'list', activeOnly ?? true] as const,
  detail: (id: string)           => ['customers', 'detail', id]               as const,
};

export const useCustomers = (options?: { activeOnly?: boolean; enabled?: boolean }) => {
  const activeOnly = options?.activeOnly ?? true;
  return useQuery<Customer[]>({
    queryKey: QK.list(activeOnly),
    queryFn:  () => customersApi.list(activeOnly),
    enabled:  options?.enabled ?? true,
    staleTime: 60_000,
  });
};

export const useCustomer = (id: string) =>
  useQuery<Customer | null>({
    queryKey: QK.detail(id),
    queryFn:  () => customersApi.get(id),
    enabled:  !!id,
  });

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Customer>) => customersApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Client créé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Customer> & { id: string }) =>
      customersApi.update(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.setQueryData(QK.detail(data.id), data);
      toast.success('Client mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Client supprimé');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
