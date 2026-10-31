import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { FileText, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { BonExpeditionForm } from "./BonExpeditionForm";
import { printBonExpedition } from "./printBonExpedition";
import {
  useBonExpeditions,
  useCreateBonExpedition,
  useDeleteBonExpedition,
  useUpdateBonExpedition,
} from "@/hooks/useBonExpedition";
import type { BonExpedition } from "@/types/bonExpedition";

const STATUT_BADGE: Record<string, { label: string; class: string }> = {
  brouillon: { label: "À compléter", class: "bg-amber-100 text-amber-800 border-amber-200" },
  valide:    { label: "Validé ✓",    class: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  annule:    { label: "Annulé",    class: "bg-red-100 text-red-700 border-red-200" },
};

type StatusFilter = "all" | "brouillon" | "valide" | "annule";

interface BonExpeditionDashboardProps {
  autoOpenCreate?: boolean;
  createNonce?: number;
}

export function BonExpeditionDashboard({
  autoOpenCreate = false,
  createNonce = 0,
}: BonExpeditionDashboardProps = {}) {
  const { data: bons = [], isLoading } = useBonExpeditions();
  const create = useCreateBonExpedition();
  const update = useUpdateBonExpedition();
  const remove = useDeleteBonExpedition();

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [editing, setEditing]           = useState<BonExpedition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BonExpedition | null>(null);

  const openCreate = useCallback(() => { setEditing(null); setSheetOpen(true); }, []);
  const openEdit   = useCallback((b: BonExpedition) => { setEditing(b); setSheetOpen(true); }, []);

  useEffect(() => {
    if (autoOpenCreate) openCreate();
  }, [autoOpenCreate, openCreate]);

  useEffect(() => {
    if (createNonce > 0) openCreate();
  }, [createNonce, openCreate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bons.filter((b) => {
      if (statusFilter !== "all" && b.statut !== statusFilter) return false;
      if (!q) return true;
      return (
        b.numero_bon?.toLowerCase().includes(q) ||
        b.code_fournisseur?.toLowerCase().includes(q) ||
        b.lieu?.toLowerCase().includes(q) ||
        b.numero_camion?.toLowerCase().includes(q) ||
        b.export_order_ref?.toLowerCase().includes(q)
      );
    });
  }, [bons, search, statusFilter]);

  const counts = useMemo(() => ({
    all: bons.length,
    brouillon: bons.filter((b) => b.statut === "brouillon").length,
    valide: bons.filter((b) => b.statut === "valide").length,
    annule: bons.filter((b) => b.statut === "annule").length,
  }), [bons]);

  const handleSubmit = useCallback(async (data: Partial<BonExpedition>) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    setSheetOpen(false);
  }, [editing, update, create]);

  const filterChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: counts.all },
    { key: "brouillon", label: "À compléter", count: counts.brouillon },
    { key: "valide", label: "Validés", count: counts.valide },
    { key: "annule", label: "Annulés", count: counts.annule },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 h-11"
            placeholder="N° bon, client, camion, commande export…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate} size="lg" className="gap-2 h-11">
          <Plus className="h-4 w-4" /> Créer un BDE
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setStatusFilter(chip.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === chip.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {chip.label} · {chip.count}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
          <FileText className="h-10 w-10 opacity-30" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {search || statusFilter !== "all" ? "Aucun bon trouvé" : "Aucun BDE pour l’instant"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search || statusFilter !== "all"
                ? "Modifiez la recherche ou le filtre."
                : "Créez le bon avant le départ camion, puis imprimez-le pour le transporteur."}
            </p>
          </div>
          {!search && statusFilter === "all" && (
            <Button onClick={openCreate} className="gap-2 mt-1">
              <Plus className="h-4 w-4" /> Créer le premier BDE
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const statBadge = STATUT_BADGE[b.statut] ?? STATUT_BADGE.brouillon;
            return (
              <div
                key={b.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-semibold text-primary">{b.numero_bon}</span>
                    <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", statBadge.class)}>
                      {statBadge.label}
                    </Badge>
                    {b.bio_certifie && (
                      <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">BIO</Badge>
                    )}
                    {b.ggp && (
                      <Badge variant="outline" className="text-xs border-sky-300 text-sky-700">GGP</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {b.code_fournisseur || b.lieu || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.date_expedition ?? "—"}
                    {b.numero_camion ? ` · Camion ${b.numero_camion}` : ""}
                    {b.lieu ? ` · ${b.lieu}` : ""}
                    {b.export_order_ref ? ` · Export ${b.export_order_ref}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    onClick={() => printBonExpedition(b)}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    onClick={() => openEdit(b)}
                  >
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 rounded-xl p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(b)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle>
              {editing ? `Modifier ${editing.numero_bon}` : "Nouveau Bon d’Expédition (BDE)"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <BonExpeditionForm
              initial={editing ?? undefined}
              onSubmit={handleSubmit}
              isSaving={create.isPending || update.isPending}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.numero_bon} — {deleteTarget?.code_fournisseur ?? deleteTarget?.lieu}. Irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) { await remove.mutateAsync(deleteTarget.id); setDeleteTarget(null); }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
