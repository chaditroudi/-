import { toast } from 'sonner';
import type { Material } from '@/types/mes';
import {
  useListMaterialsQuery,
  useCreateMaterialMutation,
  useUpdateMaterialMutation,
  useDeleteMaterialMutation,
} from '@/store/api/materialsApi';

type QueryOptions = { enabled?: boolean };

export const useMaterials = (options?: QueryOptions) => {
  return useListMaterialsQuery(undefined, { skip: !(options?.enabled ?? true) });
};

export const useCreateMaterial = () => {
  const [create, state] = useCreateMaterialMutation();

  return {
    mutateAsync: async (material: Omit<Material, 'id' | 'created_at' | 'updated_at'>) => {
      const data = await create(material).unwrap();
      toast.success('Matière créée avec succès');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useUpdateMaterial = () => {
  const [update, state] = useUpdateMaterialMutation();

  return {
    mutateAsync: async ({ id, ...material }: Partial<Material> & { id: string }) => {
      const data = await update({ id, ...material }).unwrap();
      toast.success('Matière mise à jour');
      return data;
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};

export const useDeleteMaterial = () => {
  const [remove, state] = useDeleteMaterialMutation();

  return {
    mutateAsync: async (id: string) => {
      await remove(id).unwrap();
      toast.success('Matière supprimée');
    },
    isPending: state.isLoading,
    isError: !!state.error,
  };
};
