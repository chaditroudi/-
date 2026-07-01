import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { FileText, Pencil, Plus, Printer, Search, Trash2, ClipboardPlus } from "lucide-react";
import { BonReceptionAchatForm } from "./BonReceptionAchatForm";
import { printBonReceptionAchat } from "./printBonReceptionAchat";
import {
  useBonReceptionsAchat,
  useCreateBonReceptionAchat,
  useDeleteBonReceptionAchat,
  useUpdateBonReceptionAchat,
} from "@/hooks/useBonReceptionAchat";
import { useCreateBatch } from "@/hooks/useBatches";
import type { BonReceptionAchat } from "@/types/bonReceptionAchat";

const STATUT_BADGE: Record<string, { label: string; class: string }> = {
  brouillon: { label: "À compléter",  class: "bg-amber-100 text-amber-800 border-amber-300" },
  valide:    { label: "Validé ✓",     class: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  annule:    { label: "Annulé",       class: "bg-red-100 text-red-700 border-red-200" },
};

export function BonReceptionAchatDashboard() {
  const { data: bons = [], isLoading } = useBonReceptionsAchat();
  const create      = useCreateBonReceptionAchat();
  const update      = useUpdateBonReceptionAchat();
  const remove      = useDeleteBonReceptionAchat();
  const createBatch = useCreateBatch();

  const [search, setSearch]             = useState("");
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [editing, setEditing]           = useState<BonReceptionAchat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BonReceptionAchat | null>(null);

  const filtered = useMemo(() => {
    if (!search) return bons;
    const q = search.toLowerCase();
    return bons.filter((b) =>
      b.numero_bon?.toLowerCase().includes(q) ||
      b.fournisseur_nom?.toLowerCase().includes(q) ||
      b.numero_lot?.toLowerCase().includes(q) ||
      b.numero_camion?.toLowerCase().includes(q),
    );
  }, [bons, search]);

  const openCreate = useCallback(() => { setEditing(null); setSheetOpen(true); }, []);
  const openEdit   = useCallback((b: BonReceptionAchat) => { setEditing(b); setSheetOpen(true); }, []);

  const handleCreateLot = useCallback(async (bon: BonReceptionAchat) => {
    const totalNet =
      (bon.branche_premiere?.poid_net ?? 0) +
      (bon.branche_deuxieme?.poid_net ?? 0) +
      (bon.vrac?.poid_net ?? 0) +
      (bon.branche_seche?.poid_net ?? 0);
    await createBatch.mutateAsync({
      origin_region:     bon.region ?? undefined,
      harvest_date:      bon.date_reception ?? undefined,
      initial_weight_kg: totalNet > 0 ? totalNet : 1,
      notes:             `Créé depuis BRA ${bon.numero_bon}`,
      created_by:        bon.responsable_reception ?? undefined,
    });
  }, [createBatch]);

  const handleSubmit = useCallback(async (data: Partial<BonReceptionAchat>) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...data });
      } else {
        await create.mutateAsync(data);
      }
      setSheetOpen(false);
    } catch {
      // Error toast handled by mutation's onError; sheet stays open for retry
    }
  }, [editing, update, create]);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10 text-sm"
            placeholder="Chercher par fournisseur, N° bon ou N° lot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate} className="h-10 gap-2 text-sm">
          <Plus className="h-4 w-4" /> Nouveau bon
        </Button>
      </div>

      {/* ── Status summary ── */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(STATUT_BADGE).map(([key, { label, class: cls }]) => {
          const count = bons.filter((b) => b.statut === key).length;
          if (count === 0) return null;
          return (
            <Badge key={key} variant="outline" className={cn("px-3 py-1 text-sm font-medium", cls)}>
              {label} · {count}
            </Badge>
          );
        })}
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">{search ? "Aucun résultat pour cette recherche." : "Aucun bon de réception créé pour l'instant."}</p>
          {!search && (
            <Button onClick={openCreate} className="gap-2 mt-1">
              <Plus className="h-4 w-4" /> Créer le premier bon
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
                {/* Info */}
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-semibold text-primary">{b.numero_bon}</span>
                    <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", statBadge.class)}>
                      {statBadge.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {b.fournisseur_nom ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.date_reception ?? "—"}
                    {b.numero_lot ? ` · Lot ${b.numero_lot}` : ""}
                    {b.numero_camion ? ` · Camion ${b.numero_camion}` : ""}
                    {b.lieu_reception ? ` · ${b.lieu_reception}` : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {b.statut === "valide" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => handleCreateLot(b)}
                      disabled={createBatch.isPending}
                    >
                      <ClipboardPlus className="h-3.5 w-3.5" />
                      Créer lot
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl text-xs"
                    onClick={() => printBonReceptionAchat(b)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl text-xs"
                    onClick={() => openEdit(b)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 rounded-xl p-0 text-destructive hover:bg-destructive/10"
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

      {/* ── Create / Edit panel ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle>
              {editing ? `Modifier · ${editing.numero_bon}` : "Nouveau bon de réception achat"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-6 pt-4">
            <BonReceptionAchatForm
              initial={editing ?? undefined}
              onSubmit={handleSubmit}
              isSaving={create.isPending || update.isPending}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.numero_bon}</strong> — {deleteTarget?.fournisseur_nom}.
              Cette action est définitive et ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non, garder</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await remove.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Oui, supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
