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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createBatch.mutate(
      {
        supplier_id: supplierId || undefined,
        material_id: materialId || undefined,
        origin_region: originRegion || undefined,
        origin_farm: originFarm || undefined,
        harvest_date: harvestDate || undefined,
        initial_weight_kg: parseFloat(initialWeight),
        notes: notes || undefined,
        created_by: createdBy || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau Lot de Dattes</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="createdBy">TN-BIO-001</Label>
              <Input id="TN-BIO-001" value="TN-BIO-001" />
            </div>

            <div>
              <Label htmlFor="supplierId">Fournisseur</Label>
              <Select value={supplierId || "none"} onValueChange={(val) => setSupplierId(val === "none" ? "" : val)}>
                <SelectTrigger>
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
              <Label htmlFor="materialId">Type de dattes</Label>
              <Select value={materialId || "none"} onValueChange={(val) => setMaterialId(val === "none" ? "" : val)}>
                <SelectTrigger>
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
              <Label htmlFor="originRegion">Région d'origine</Label>
              <Input
                id="originRegion"
                value={originRegion}
                onChange={(e) => setOriginRegion(e.target.value)}
                placeholder="Ex: Tozeur"
              />
            </div>

            <div>
              <Label htmlFor="originFarm">Exploitation</Label>
              <Input
                id="originFarm"
                value={originFarm}
                onChange={(e) => setOriginFarm(e.target.value)}
                placeholder="Nom de l'exploitation"
              />
            </div>

            <div>
              <Label htmlFor="harvestDate">Date de Réception</Label>
              <Input
                id="harvestDate"
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="initialWeight">Poids initial (kg) *</Label>
              <Input
                id="initialWeight"
                type="number"
                step="0.1"
                min="0"
                value={initialWeight}
                onChange={(e) => setInitialWeight(e.target.value)}
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="createdBy">Réceptionné par</Label>
              <Input
                id="createdBy"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="Nom de l'opérateur"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
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
