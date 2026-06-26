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
import { FileText, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { BonReceptionAchatForm } from "./BonReceptionAchatForm";
import { printBonReceptionAchat } from "./printBonReceptionAchat";
import {
  useBonReceptionsAchat,
  useCreateBonReceptionAchat,
  useDeleteBonReceptionAchat,
  useUpdateBonReceptionAchat,
} from "@/hooks/useBonReceptionAchat";
import type { BonReceptionAchat } from "@/types/bonReceptionAchat";

const STATUT_BADGE: Record<string, { label: string; class: string }> = {
  brouillon: { label: "Brouillon", class: "bg-amber-100 text-amber-800 border-amber-200" },
  valide:    { label: "Validé",    class: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  annule:    { label: "Annulé",    class: "bg-red-100 text-red-700 border-red-200" },
};

export function BonReceptionAchatDashboard() {
  const { data: bons = [], isLoading } = useBonReceptionsAchat();
  const create = useCreateBonReceptionAchat();
  const update = useUpdateBonReceptionAchat();
  const remove = useDeleteBonReceptionAchat();

  const [search, setSearch]           = useState("");
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [editing, setEditing]         = useState<BonReceptionAchat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BonReceptionAchat | null>(null);

  const filtered = useMemo(() => {
    if (!search) return bons;
    const q = search.toLowerCase();
    return bons.filter((b) =>
      b.numero_bon?.toLowerCase().includes(q) ||
      b.fournisseur_nom?.toLowerCase().includes(q) ||
      b.numero_lot?.toLowerCase().includes(q) ||
      b.numero_camion?.toLowerCase().includes(q)
    );
  }, [bons, search]);

  const openCreate = useCallback(() => { setEditing(null); setSheetOpen(true); }, []);
  const openEdit   = useCallback((b: BonReceptionAchat) => { setEditing(b); setSheetOpen(true); }, []);

  const handleSubmit = useCallback(async (data: Partial<BonReceptionAchat>) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    setSheetOpen(false);
  }, [editing, update, create]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Rechercher N° bon, fournisseur, lot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate} className="gap-2 h-9">
          <Plus className="h-4 w-4" /> Nouveau bon
        </Button>
      </div>

      {/* Status counts */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(STATUT_BADGE).map(([key, { label, class: cls }]) => {
          const count = bons.filter((b) => b.statut === key).length;
          return (
            <Badge key={key} variant="outline" className={cn("text-xs px-2 py-1", cls)}>
              {label}&nbsp;· {count}
            </Badge>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">{search ? "Aucun résultat" : "Aucun bon de réception créé"}</p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Créer le premier
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                <th className="text-left px-4 py-2.5 font-medium">N° Bon</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Fournisseur</th>
                <th className="text-left px-4 py-2.5 font-medium">N° Lot</th>
                <th className="text-left px-4 py-2.5 font-medium">Camion</th>
                <th className="text-left px-4 py-2.5 font-medium">Lieu</th>
                <th className="text-left px-4 py-2.5 font-medium">Statut</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const statBadge = STATUT_BADGE[b.statut] ?? STATUT_BADGE.brouillon;
                return (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium text-primary">{b.numero_bon}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.date_reception}</td>
                    <td className="px-4 py-2.5 font-medium">{b.fournisseur_nom ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.numero_lot ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.numero_camion ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{b.lieu_reception ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-xs", statBadge.class)}>
                        {statBadge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => printBonReceptionAchat(b)} title="Imprimer"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => openEdit(b)} title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(b)} title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle>
              {editing ? `Modifier ${editing.numero_bon}` : "Nouveau bon de réception achat"}
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.numero_bon} — {deleteTarget?.fournisseur_nom}. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await remove.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }
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
