import { Package, Minus, Box, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Types de contenants principaux
export type ContainerType = 'PALETTE' | 'CAISSE' | 'AUTRE';

// Types de caisses
export type CrateType = 'PLASTIQUE' | 'BOIS' | 'CARTON';

// Modèles de caisses avec leurs tares
export type CrateModel = 
  | 'CAISSE_AJOUREE_20KG' 
  | 'CAISSE_PLEINE_25KG' 
  | 'CAISSE_STANDARD_15KG'
  | 'JUMBO_BAG'
  | 'CAISSE_BOIS_30KG'
  | 'CARTON_10KG';

interface CrateModelInfo {
  label: string;
  tare: number;
  crateType: CrateType;
}

const CRATE_MODELS: Record<CrateModel, CrateModelInfo> = {
  'CAISSE_AJOUREE_20KG': { label: 'Caisse ajourée 20kg', tare: 1.80, crateType: 'PLASTIQUE' },
  'CAISSE_PLEINE_25KG': { label: 'Caisse pleine 25kg', tare: 2.50, crateType: 'PLASTIQUE' },
  'CAISSE_STANDARD_15KG': { label: 'Caisse standard 15kg', tare: 1.20, crateType: 'PLASTIQUE' },
  'JUMBO_BAG': { label: 'Jumbo Bag', tare: 1.50, crateType: 'PLASTIQUE' },
  'CAISSE_BOIS_30KG': { label: 'Caisse bois 30kg', tare: 4.10, crateType: 'BOIS' },
  'CARTON_10KG': { label: 'Carton 10kg', tare: 0.35, crateType: 'CARTON' },
};

const CONTAINER_LABELS: Record<ContainerType, string> = {
  'PALETTE': 'Palette',
  'CAISSE': 'Caisse',
  'AUTRE': 'Autre (Vrac)'
};

const CRATE_TYPE_LABELS: Record<CrateType, string> = {
  'PLASTIQUE': 'Plastique',
  'BOIS': 'Bois',
  'CARTON': 'Carton'
};

// Tare fixe pour palette seule
const PALETTE_TARE = 25.0;

interface TareCalculatorProps {
  containerType: ContainerType;
  crateType: CrateType;
  crateModel: CrateModel | null;
  unitCount: number;
  grossWeight: number;
  onContainerTypeChange: (type: ContainerType) => void;
  onCrateTypeChange: (type: CrateType) => void;
  onCrateModelChange: (model: CrateModel) => void;
  onUnitCountChange: (count: number) => void;
}

export const TareCalculator = ({
  containerType,
  crateType,
  crateModel,
  unitCount,
  grossWeight,
  onContainerTypeChange,
  onCrateTypeChange,
  onCrateModelChange,
  onUnitCountChange
}: TareCalculatorProps) => {
  
  // Get tare per unit based on container type and model
  const getTarePerUnit = (): number => {
    if (containerType === 'PALETTE') return PALETTE_TARE;
    if (containerType === 'AUTRE') return 0;
    if (containerType === 'CAISSE' && crateModel) {
      return CRATE_MODELS[crateModel]?.tare || 0;
    }
    return 0;
  };

  const tarePerUnit = getTarePerUnit();
  const totalTare = Math.max(0, unitCount * tarePerUnit); // JAMAIS négative
  const netWeight = Math.max(0, grossWeight - totalTare);

  // Filter crate models by selected crate type
  const filteredModels = Object.entries(CRATE_MODELS)
    .filter(([_, info]) => info.crateType === crateType)
    .map(([key, info]) => ({ key: key as CrateModel, ...info }));

  // Get container unit label
  const getUnitLabel = () => {
    if (containerType === 'PALETTE') return 'palettes';
    if (containerType === 'CAISSE') return 'caisses';
    return 'unités';
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Calcul des Tares
          <Badge variant="outline" className="ml-auto text-xs">Corrigé</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* A. Contenants */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            A. Contenants
          </Label>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Type de contenant */}
            <div className="space-y-1.5">
              <Label className="text-xs">Type de contenant</Label>
              <Select value={containerType} onValueChange={(v) => onContainerTypeChange(v as ContainerType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTAINER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {key === 'PALETTE' && <Layers className="h-3.5 w-3.5" />}
                        {key === 'CAISSE' && <Box className="h-3.5 w-3.5" />}
                        {key === 'AUTRE' && <Package className="h-3.5 w-3.5" />}
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type de caisse (si contenant = caisse) */}
            {containerType === 'CAISSE' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Type de caisse *</Label>
                <Select value={crateType} onValueChange={(v) => onCrateTypeChange(v as CrateType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRATE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Modèle de caisse (si contenant = caisse) */}
          {containerType === 'CAISSE' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Modèle de caisse</Label>
              <Select 
                value={crateModel || ''} 
                onValueChange={(v) => onCrateModelChange(v as CrateModel)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner un modèle..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredModels.map((model) => (
                    <SelectItem key={model.key} value={model.key}>
                      {model.label} ({model.tare} kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Tare unitaire (readonly, auto) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tare unitaire (kg)</Label>
              <Input
                type="text"
                value={tarePerUnit.toFixed(2)}
                readOnly
                className="h-9 bg-muted/50 text-center font-mono"
              />
            </div>

            {/* Nombre de contenants */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Nombre de {getUnitLabel()}
              </Label>
              <Input
                type="number"
                value={unitCount || ''}
                onChange={(e) => onUnitCountChange(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="h-9 text-center font-bold text-lg"
              />
            </div>
          </div>
        </div>

        {/* B. Calcul automatique */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            B. Calcul automatique
          </Label>
          
          <div className="p-4 bg-muted/50 rounded-lg space-y-3 border">
            {/* Formule de calcul */}
            {unitCount > 0 && tarePerUnit > 0 && (
              <div className="text-sm text-center font-mono bg-background/50 rounded p-2 border-dashed border">
                <span className="text-primary font-bold">{unitCount}</span>
                <span className="text-muted-foreground"> {getUnitLabel()} × </span>
                <span className="text-primary font-bold">{tarePerUnit.toFixed(2)}</span>
                <span className="text-muted-foreground"> kg = </span>
                <span className="text-amber-600 font-bold">{totalTare.toFixed(2)} kg</span>
              </div>
            )}

            {/* Poids Brut */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Poids Brut</span>
              <span className="font-semibold">{grossWeight.toFixed(2)} KG</span>
            </div>

            {/* Tare Totale */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Minus className="h-3 w-3" /> Tare Totale
              </span>
              <span className="font-semibold text-amber-600">
                -{totalTare.toFixed(2)} KG
                {totalTare === 0 && containerType !== 'AUTRE' && (
                  <Badge variant="outline" className="ml-2 text-xs">À configurer</Badge>
                )}
              </span>
            </div>

            {/* Poids Net */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Poids Net Estimé</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-primary">{netWeight.toFixed(2)} KG</span>
                  <Badge variant="default" className="bg-emerald-500">✓</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            La tare totale ne peut jamais être négative
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Export types and constants for use elsewhere
export { CRATE_MODELS, CONTAINER_LABELS, CRATE_TYPE_LABELS, PALETTE_TARE };
export type { CrateModelInfo };
