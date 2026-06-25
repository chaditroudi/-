import { Droplets, Bug, AlertTriangle, CheckCircle2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranding } from '@/hooks/useBranding';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface PreQualityCheckProps {
  moisture: number;
  infestation: boolean;
  onMoistureChange: (value: number) => void;
  onInfestationChange: (value: boolean) => void;
}

export const PreQualityCheck = ({
  moisture,
  infestation,
  onMoistureChange,
  onInfestationChange
}: PreQualityCheckProps) => {
  const { companyName } = useBranding();
  const moistureStatus = moisture > 22 ? 'critical' : moisture > 18 ? 'warning' : 'ok';

  const handleMoistureIncrement = () => {
    onMoistureChange(Math.min(100, moisture + 0.5));
  };

  const handleMoistureDecrement = () => {
    onMoistureChange(Math.max(0, moisture - 0.5));
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
      <CardHeader className="pb-3 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Droplets className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="font-bold text-foreground">Pré-Contrôle Qualité</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                Inspection rapide avant stockage
              </p>
            </div>
          </CardTitle>
          <img 
            src=""
            alt=""
            className="hidden"
          />
          <BrandLogo className="h-10 w-10 shrink-0 opacity-80" imgClassName="h-full w-full object-contain" alt={companyName} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-5">
        {/* Moisture Level */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Droplets className="h-4 w-4 text-blue-500" />
              Taux d'Humidité
            </label>
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
              moistureStatus === 'ok' && "bg-green-100 text-green-700",
              moistureStatus === 'warning' && "bg-orange-100 text-orange-700",
              moistureStatus === 'critical' && "bg-red-100 text-red-700"
            )}>
              {moistureStatus === 'ok' ? (
                <><CheckCircle2 className="h-3 w-3" /> Normal</>
              ) : moistureStatus === 'warning' ? (
                <><AlertTriangle className="h-3 w-3" /> Élevé</>
              ) : (
                <><AlertTriangle className="h-3 w-3" /> Critique</>
              )}
            </div>
          </div>

          {/* Value Display with Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleMoistureDecrement}
              className="h-12 w-12 rounded-full border-2 hover:bg-primary/10 hover:border-primary"
            >
              <Minus className="h-5 w-5" />
            </Button>
            
            <div className={cn(
              "flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 transition-all duration-300",
              moistureStatus === 'ok' && "border-green-500 bg-green-50",
              moistureStatus === 'warning' && "border-orange-500 bg-orange-50",
              moistureStatus === 'critical' && "border-red-500 bg-red-50 animate-pulse"
            )}>
              <span className={cn(
                "text-3xl font-bold",
                moistureStatus === 'ok' && "text-green-700",
                moistureStatus === 'warning' && "text-orange-700",
                moistureStatus === 'critical' && "text-red-700"
              )}>
                {moisture.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground font-medium">%</span>
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleMoistureIncrement}
              className="h-12 w-12 rounded-full border-2 hover:bg-primary/10 hover:border-primary"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Slider */}
          <div className="px-2">
            <Slider
              value={[moisture]}
              onValueChange={(values) => onMoistureChange(values[0])}
              min={0}
              max={40}
              step={0.5}
              className={cn(
                "w-full",
                moistureStatus === 'ok' && "[&_[role=slider]]:bg-green-500 [&_.bg-primary]:bg-green-500",
                moistureStatus === 'warning' && "[&_[role=slider]]:bg-orange-500 [&_.bg-primary]:bg-orange-500",
                moistureStatus === 'critical' && "[&_[role=slider]]:bg-red-500 [&_.bg-primary]:bg-red-500"
              )}
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>0%</span>
              <span className="text-green-600 font-medium">18%</span>
              <span className="text-orange-600 font-medium">22%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Status Message */}
          <div className={cn(
            "p-3 rounded-lg text-sm flex items-center gap-2",
            moistureStatus === 'ok' && "bg-green-50 text-green-800 border border-green-200",
            moistureStatus === 'warning' && "bg-orange-50 text-orange-800 border border-orange-200",
            moistureStatus === 'critical' && "bg-red-50 text-red-800 border border-red-200"
          )}>
            {moistureStatus === 'critical' ? (
              <>
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span><strong>⚠️ Humidité critique (&gt;22%)</strong> - Mise en quarantaine recommandée</span>
              </>
            ) : moistureStatus === 'warning' ? (
              <>
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span><strong>⚡ Humidité élevée (18-22%)</strong> - Surveillance requise</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span><strong>✓ Humidité normale (&lt;18%)</strong> - Conforme aux standards</span>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-muted-foreground/30" />

        {/* Infestation Detection */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Bug className="h-4 w-4 text-amber-600" />
            Détection Infestation Visuelle
          </label>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onInfestationChange(false)}
              className={cn(
                "h-20 flex-col gap-2 font-bold text-base transition-all duration-300 border-2",
                !infestation 
                  ? "bg-green-500 hover:bg-green-600 text-white border-green-600 shadow-lg shadow-green-500/30" 
                  : "hover:bg-green-50 hover:border-green-300"
              )}
            >
              <CheckCircle2 className={cn("h-6 w-6", !infestation && "animate-bounce")} />
              SAIN
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => onInfestationChange(true)}
              className={cn(
                "h-20 flex-col gap-2 font-bold text-base transition-all duration-300 border-2",
                infestation 
                  ? "bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/30 animate-pulse" 
                  : "hover:bg-red-50 hover:border-red-300"
              )}
            >
              <AlertTriangle className="h-6 w-6" />
              DÉTECTÉ
            </Button>
          </div>
          
          {infestation && (
            <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg text-sm text-red-800 flex items-start gap-2 animate-in slide-in-from-top-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block">⚠️ Infestation détectée</strong>
                <span className="text-xs">Le lot sera automatiquement mis en quarantaine pour inspection approfondie.</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
