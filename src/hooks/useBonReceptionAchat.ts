import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BonReceptionAchat, BonReceptionAchatInput } from "@/types/bonReceptionAchat";

const BASE = "/api/bon-receptions-achat";

const apiFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || "";
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || err?.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const QK = {
  list: (params?: Record<string, string>) => ["bon_receptions_achat", "list", params ?? {}] as const,
  detail: (id: string) => ["bon_receptions_achat", "detail", id] as const,
};

export const useBonReceptionsAchat = (params?: { fournisseur_id?: string; statut?: string }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => !!v)) as Record<string, string>,
  ).toString();
  return useQuery<BonReceptionAchat[]>({
    queryKey: QK.list(params as Record<string, string>),
    queryFn: async () => {
      const r: any = await apiFetch(`${BASE}${qs ? `?${qs}` : ""}`);
      return r.data ?? [];
    },
    staleTime: 60_000,
  });
};

export const useBonReceptionAchat = (id: string) =>
  useQuery<BonReceptionAchat | null>({
    queryKey: QK.detail(id),
    queryFn: async () => {
      const r: any = await apiFetch(`${BASE}/${id}`);
      return r.data ?? null;
    },
    enabled: !!id,
  });

export const useCreateBonReceptionAchat = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BonReceptionAchatInput>) => {
      const r: any = await apiFetch(BASE, { method: "POST", body: JSON.stringify(input) });
      return r.data as BonReceptionAchat;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bon_receptions_achat"] });
      toast.success("Bon de réception créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateBonReceptionAchat = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BonReceptionAchat> & { id: string }) => {
      const r: any = await apiFetch(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      return r.data as BonReceptionAchat;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bon_receptions_achat"] });
      qc.setQueryData(QK.detail(data.id), data);
      toast.success("Bon mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteBonReceptionAchat = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${BASE}/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bon_receptions_achat"] });
      toast.success("Bon supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
