import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Material } from "@/types/mes";

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: Material | null;
  onSave: (data: Omit<Material, "id" | "created_at" | "updated_at">) => void;
  isLoading?: boolean;
}

const categories = [
  "Dattes Deglet Nour",
  "Dattes Allig",
  "Dattes Khouat",
  "Emballage",
  "Consommables",
  "Datte Kintichi",
  "Caisses",
  "Autre",
];

const units = ["kg", "g", "tonne", "unité", "carton", "palette"];

const caisseTypes = ["PL", "GC", "PLOX", "LAMME"];

export const MaterialDialog = ({ open, onOpenChange, material, onSave, isLoading }: MaterialDialogProps) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    unit: "kg",
    category: "",
    min_stock: 0,
    caisse_type: "",
  });

  useEffect(() => {
    if (material) {
      setFormData({
        code: material.code,
        name: material.name,
        description: material.description || "",
        unit: material.unit,
        category: material.category || "",
        min_stock: material.min_stock,
        caisse_type: "",
      });
    } else {
      setFormData({
        code: "",
        name: "",
        description: "",
        unit: "kg",
        category: "",
        min_stock: 0,
        caisse_type: "",
      });
    }
  }, [material, open]);

  const handleCategoryChange = (value: string) => {
    setFormData({ ...formData, category: value, caisse_type: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{material ? "Modifier Matière" : "Nouvelle Matière"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="MAT-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nom de la matière"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            <Select value={formData.category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.category === "Caisses" && (
            <div className="space-y-2">
              <Label htmlFor="caisse_type">Type de Caisse</Label>
              <Select
                value={formData.caisse_type}
                onValueChange={(value) => setFormData({ ...formData, caisse_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {caisseTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description de la matière"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unité</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_stock">Stock Minimum</Label>
              <Input
                id="min_stock"
                type="number"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
