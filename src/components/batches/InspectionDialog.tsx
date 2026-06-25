import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCreateInspection } from '@/hooks/useBatches';
import { Batch, qualityGradeLabels, qualityGradeColors, QualityGrade } from '@/types/batch';
import { Scale, Eye, Bug, Droplets, Thermometer, CheckCircle, XCircle } from 'lucide-react';

interface InspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
}

export const InspectionDialog = ({ open, onOpenChange, batch }: InspectionDialogProps) => {
  // Weight
  const [weightMeasured, setWeightMeasured] = useState(batch.current_weight_kg.toString());
  const [weightExpected, setWeightExpected] = useState(batch.initial_weight_kg.toString());
  
  // Visual
  const [visualAppearance, setVisualAppearance] = useState('');
  const [colorUniformity, setColorUniformity] = useState(true);
  const [sizeUniformity, setSizeUniformity] = useState(true);
  
  // Contamination
  const [moldDetected, setMoldDetected] = useState(false);
  const [moldPercentage, setMoldPercentage] = useState('');
  const [pestDetected, setPestDetected] = useState(false);
  const [pestType, setPestType] = useState('');
  
  // Humidity & Temperature
  const [humidityMeasured, setHumidityMeasured] = useState('');
  const [temperatureMeasured, setTemperatureMeasured] = useState('');
  
  // Meta
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');

  const createInspection = useCreateInspection();

  // Calculate preview results
  const weightVariance = weightExpected && weightMeasured
    ? ((parseFloat(weightMeasured) - parseFloat(weightExpected)) / parseFloat(weightExpected)) * 100
    : null;
  const weightPassed = weightVariance !== null ? Math.abs(weightVariance) <= 5 : null;
  const visualPassed = colorUniformity && sizeUniformity;
  const contaminationPassed = !moldDetected && !pestDetected;
  const humidityPassed = humidityMeasured 
    ? parseFloat(humidityMeasured) >= 14 && parseFloat(humidityMeasured) <= 18 
    : null;
  
  const overallPassed = weightPassed !== false && 
                        visualPassed !== false && 
                        contaminationPassed && 
                        humidityPassed !== false;

  // Determine grade preview
  let predictedGrade: QualityGrade = 'rejected';
  if (overallPassed) {
    if (!moldDetected && !pestDetected && humidityMeasured && 
        parseFloat(humidityMeasured) >= 14 && parseFloat(humidityMeasured) <= 16) {
      predictedGrade = 'premium';
    } else if (humidityPassed) {
      predictedGrade = 'standard';
    } else {
      predictedGrade = 'economy';
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createInspection.mutate({
      batch_id: batch.id,
      weight_measured_kg: parseFloat(weightMeasured),
      weight_expected_kg: parseFloat(weightExpected),
      visual_appearance: visualAppearance || undefined,
      color_uniformity: colorUniformity,
      size_uniformity: sizeUniformity,
      mold_detected: moldDetected,
      mold_percentage: moldPercentage ? parseFloat(moldPercentage) : undefined,
      pest_detected: pestDetected,
      pest_type: pestType || undefined,
      humidity_measured: humidityMeasured ? parseFloat(humidityMeasured) : undefined,
      temperature_measured: temperatureMeasured ? parseFloat(temperatureMeasured) : undefined,
      inspector_name: inspectorName,
      notes: notes || undefined
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const ResultIndicator = ({ passed }: { passed: boolean | null }) => {
    if (passed === null) return <span className="text-gray-400">-</span>;
    return passed 
      ? <CheckCircle className="h-5 w-5 text-green-500" />
      : <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inspection Qualité - {batch.batch_number}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Result Preview */}
          <Card className={overallPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {overallPassed 
                    ? <CheckCircle className="h-6 w-6 text-green-600" />
                    : <XCircle className="h-6 w-6 text-red-600" />
                  }
                  <span className="font-medium text-lg">
                    {overallPassed ? 'Lot Conforme' : 'Lot Non Conforme'}
                  </span>
                </div>
                <Badge className={`${qualityGradeColors[predictedGrade]} text-white`}>
                  Grade: {qualityGradeLabels[predictedGrade]}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            {/* Weight Verification */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Vérification Poids
                  <ResultIndicator passed={weightPassed} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Attendu (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={weightExpected}
                      onChange={(e) => setWeightExpected(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mesuré (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={weightMeasured}
                      onChange={(e) => setWeightMeasured(e.target.value)}
                    />
                  </div>
                </div>
                {weightVariance !== null && (
                  <p className={`text-sm ${Math.abs(weightVariance) <= 5 ? 'text-green-600' : 'text-red-600'}`}>
                    Écart: {weightVariance.toFixed(2)}% (max ±5%)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Visual Inspection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Inspection Visuelle
                  <ResultIndicator passed={visualPassed} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Apparence générale</Label>
                  <Input
                    value={visualAppearance}
                    onChange={(e) => setVisualAppearance(e.target.value)}
                    placeholder="Brillant, mat, sec..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Uniformité couleur</Label>
                  <Switch checked={colorUniformity} onCheckedChange={setColorUniformity} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Uniformité calibre</Label>
                  <Switch checked={sizeUniformity} onCheckedChange={setSizeUniformity} />
                </div>
              </CardContent>
            </Card>

            {/* Contamination Check */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Moisissures & Parasites
                  <ResultIndicator passed={contaminationPassed} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-red-600">Moisissure détectée</Label>
                  <Switch checked={moldDetected} onCheckedChange={setMoldDetected} />
                </div>
                {moldDetected && (
                  <div>
                    <Label className="text-xs">% de moisissure</Label>
                    <Input
                      type="number"
                      step="0.1"
                      max="100"
                      value={moldPercentage}
                      onChange={(e) => setMoldPercentage(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-red-600">Parasites détectés</Label>
                  <Switch checked={pestDetected} onCheckedChange={setPestDetected} />
                </div>
                {pestDetected && (
                  <div>
                    <Label className="text-xs">Type de parasite</Label>
                    <Input
                      value={pestType}
                      onChange={(e) => setPestType(e.target.value)}
                      placeholder="Charançon, teigne..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Humidity & Temperature */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  Humidité & Température
                  <ResultIndicator passed={humidityPassed} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Humidité mesurée (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={humidityMeasured}
                    onChange={(e) => setHumidityMeasured(e.target.value)}
                    placeholder="Cible: 14-18%"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Premium: 14-16% | Standard: 14-18%
                  </p>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    Température (°C)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={temperatureMeasured}
                    onChange={(e) => setTemperatureMeasured(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Inspector info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inspectorName">Inspecteur *</Label>
              <Input
                id="inspectorName"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Nom de l'inspecteur"
                required
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createInspection.isPending}>
              {createInspection.isPending ? 'Enregistrement...' : 'Valider l\'inspection'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
