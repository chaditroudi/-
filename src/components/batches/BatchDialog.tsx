import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateBatch } from "@/hooks/useBatches";
import { Supplier, Material } from "@/types/mes";

interface BatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  materials: Material[];
}

export const BatchDialog = ({ open, onOpenChange, suppliers, materials }: BatchDialogProps) => {
  const [supplierId, setSupplierId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [originRegion, setOriginRegion] = useState("");
  const [originFarm, setOriginFarm] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [initialWeight, setInitialWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [createdBy, setCreatedBy] = useState("");

  const createBatch = useCreateBatch();

  const resetForm = () => {
    setSupplierId("");
    setMaterialId("");
    setOriginRegion("");
    setOriginFarm("");
    setHarvestDate("");
    setInitialWeight("");
    setNotes("");
    setCreatedBy("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBatch.mutateAsync({
        supplier_id: supplierId || undefined,
        material_id: materialId || undefined,
        origin_region: originRegion || undefined,
        origin_farm: originFarm || undefined,
        harvest_date: harvestDate || undefined,
        initial_weight_kg: parseFloat(initialWeight),
        notes: notes || undefined,
        created_by: createdBy || undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error toast is handled by the mutation's onError in useBatches
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau Lot de Dattes</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Certification badge — read-only display */}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Certification</Label>
              <div className="mt-1 flex h-9 items-center rounded-md border border-border/60 bg-muted/30 px-3 text-sm font-medium text-muted-foreground">
                TN-BIO-001
              </div>
            </div>

            <div>
              <Label htmlFor="bd-supplier">Fournisseur</Label>
              <Select value={supplierId || "none"} onValueChange={(val) => setSupplierId(val === "none" ? "" : val)}>
                <SelectTrigger id="bd-supplier">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {suppliers
                    .filter((s) => s.is_active)
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.code} - {supplier.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bd-material">Type de dattes</Label>
              <Select value={materialId || "none"} onValueChange={(val) => setMaterialId(val === "none" ? "" : val)}>
                <SelectTrigger id="bd-material">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.code} - {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bd-region">Région d&apos;origine</Label>
              <Input
                id="bd-region"
                value={originRegion}
                onChange={(e) => setOriginRegion(e.target.value)}
                placeholder="Ex: Tozeur"
              />
            </div>

            <div>
              <Label htmlFor="bd-farm">Exploitation</Label>
              <Input
                id="bd-farm"
                value={originFarm}
                onChange={(e) => setOriginFarm(e.target.value)}
                placeholder="Nom de l'exploitation"
              />
            </div>

            <div>
              <Label htmlFor="bd-harvest">Date de Réception</Label>
              <Input
                id="bd-harvest"
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bd-weight">Poids initial (kg) *</Label>
              <Input
                id="bd-weight"
                type="number"
                step="0.1"
                min="0"
                value={initialWeight}
                onChange={(e) => setInitialWeight(e.target.value)}
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="bd-created-by">Réceptionné par</Label>
              <Input
                id="bd-created-by"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="Nom de l'opérateur"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="bd-notes">Notes</Label>
              <Textarea
                id="bd-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations à la réception..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createBatch.isPending}>
              {createBatch.isPending ? "Création..." : "Créer le lot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
