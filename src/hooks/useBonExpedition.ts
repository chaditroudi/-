import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@/integrations/mongodb/client";
import type { BonExpedition, BonExpeditionInput } from "@/types/bonExpedition";

const BASE = "/bon-expeditions";
type Env<T> = { data: T };

const QK = {
  list: (p?: Record<string, string>) => ["bon_expeditions", "list", p ?? {}] as const,
  detail: (id: string) => ["bon_expeditions", "detail", id] as const,
};

export const useBonExpeditions = (params?: { fournisseur_id?: string; statut?: string }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => !!v)) as Record<string, string>,
  ).toString();
  return useQuery<BonExpedition[]>({
    queryKey: QK.list(params as Record<string, string>),
    queryFn: async () => {
      const r = await apiRequest<Env<BonExpedition[]>>(`${BASE}${qs ? `?${qs}` : ""}`);
      return r.data ?? [];
    },
    staleTime: 60_000,
  });
};

export const useBonExpedition = (id: string) =>
  useQuery<BonExpedition | null>({
    queryKey: QK.detail(id),
    queryFn: async () => {
      const r = await apiRequest<Env<BonExpedition | null>>(`${BASE}/${id}`);
      return r.data ?? null;
    },
    enabled: !!id,
  });

export const useCreateBonExpedition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BonExpeditionInput>) => {
      const r = await apiRequest<Env<BonExpedition>>(BASE, { method: "POST", body: JSON.stringify(input) });
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bon_expeditions"] });
      toast.success("Bon d'expédition créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateBonExpedition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BonExpedition> & { id: string }) => {
      const r = await apiRequest<Env<BonExpedition>>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      return r.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bon_expeditions"] });
      qc.setQueryData(QK.detail(data.id), data);
      toast.success("Bon mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteBonExpedition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<Env<BonExpedition>>(`${BASE}/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bon_expeditions"] });
      toast.success("Bon supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
