import { useState, useEffect } from 'react';
import { Scale, CheckCircle2, AlertTriangle, Lock, Unlock, UserCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/** Weighing modes:
 *  SCALE        — live Modbus telemetry (currently simulated / mocked)
 *  MANUAL       — manual entry with supervisor + reason (≥10 chars)
 *  PANNE_BASCULE — RG-R08 scale failure: manual entry + 2 witnesses + reason (≥20 chars)
 */
type WeighingMode = 'SCALE' | 'MANUAL' | 'PANNE_BASCULE';

interface ScaleTelemetryProps {
  targetWeight: number;
  onWeightValidated: (payload: {
    weight: number;
    supervisor: string;
    source: 'SCALE' | 'MANUAL';
    manualReason?: string | null;
    /** RG-R08: present only when mode === PANNE_BASCULE */
    witness1?: string | null;
    witness2?: string | null;
  }) => void;
  onWeightReset: () => void;
  isValidated: boolean;
  validationMeta?: {
    weight: number;
    supervisor: string;
    time: string;
    source: 'SCALE' | 'MANUAL';
    manualReason?: string | null;
    witness1?: string | null;
    witness2?: string | null;
  } | null;
}

export const ScaleTelemetry = ({
  targetWeight,
  onWeightValidated,
  onWeightReset,
  isValidated,
  validationMeta
}: ScaleTelemetryProps) => {
  const [liveWeight, setLiveWeight] = useState(0);
  const [isStable, setIsStable] = useState(false);
  const [stabilityCounter, setStabilityCounter] = useState(0);
  const [weightMode, setWeightMode] = useState<WeighingMode>('SCALE');
  const [manualWeight, setManualWeight] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  // RG-R08: two mandatory witnesses for scale failure
  const [witness1, setWitness1] = useState('');
  const [witness2, setWitness2] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Simulate live scale weight — MOCK (no real Modbus connection)
  useEffect(() => {
    if (isValidated || weightMode !== 'SCALE') return;

    const interval = setInterval(() => {
      setLiveWeight(prev => {
        const target = targetWeight;
        const jitter = (Math.random() - 0.5) * 0.4;

        if (Math.abs(prev - target) < 0.2) {
          setStabilityCounter(c => Math.min(c + 1, 10));
          if (stabilityCounter > 5) setIsStable(true);
          return target + (Math.random() - 0.5) * 0.05;
        }

        setIsStable(false);
        setStabilityCounter(0);
        return prev + (target - prev) * 0.15 + jitter;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [targetWeight, stabilityCounter, weightMode, isValidated]);

  const currentWeight = isValidated && validationMeta
    ? validationMeta.weight
    : (weightMode === 'SCALE' ? liveWeight : parseFloat(manualWeight) || 0);

  const handleValidate = () => {
    if (!supervisorName.trim()) {
      setError("Nom du superviseur requis");
      return;
    }
    if (weightMode === 'SCALE' && !isStable) {
      setError("Attendre la stabilisation du poids bascule");
      return;
    }
    if (currentWeight <= 0) {
      setError("Poids invalide");
      return;
    }
    if (weightMode === 'MANUAL' && manualReason.trim().length < 10) {
      setError("Motif de saisie manuelle requis (10 caractères min.)");
      return;
    }
    // RG-R08 validations
    if (weightMode === 'PANNE_BASCULE') {
      if (manualReason.trim().length < 20) {
        setError("RG-R08 — Description panne requise (20 caractères min.)");
        return;
      }
      if (!witness1.trim()) {
        setError("RG-R08 — Témoin 1 requis (panne bascule)");
        return;
      }
      if (!witness2.trim()) {
        setError("RG-R08 — Témoin 2 requis (panne bascule)");
        return;
      }
      if (witness1.trim().toLowerCase() === witness2.trim().toLowerCase()) {
        setError("RG-R08 — Les deux témoins doivent être différents");
        return;
      }
    }

    setError(null);
    onWeightValidated({
      weight: currentWeight,
      supervisor: supervisorName,
      source: weightMode === 'SCALE' ? 'SCALE' : 'MANUAL',
      manualReason: weightMode !== 'SCALE' ? manualReason.trim() : null,
      witness1: weightMode === 'PANNE_BASCULE' ? witness1.trim() : null,
      witness2: weightMode === 'PANNE_BASCULE' ? witness2.trim() : null,
    });
  };

  return (
    <div className="space-y-4">
      {/* Source mode selector */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <span className="font-semibold">Télémétrie Pont-Bascule</span>
              {/* Modbus mock indicator */}
              <Badge variant="outline" className="text-[0.6rem] px-1.5 border-amber-300 bg-amber-50 text-amber-700">
                MOCK — simulation Modbus
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button variant={weightMode === 'SCALE' ? 'default' : 'outline'} size="sm"
                onClick={() => !isValidated && setWeightMode('SCALE')} disabled={isValidated} className="text-xs">
                Bascule
              </Button>
              <Button variant={weightMode === 'MANUAL' ? 'default' : 'outline'} size="sm"
                onClick={() => !isValidated && setWeightMode('MANUAL')} disabled={isValidated} className="text-xs">
                Manuel
              </Button>
              <Button variant={weightMode === 'PANNE_BASCULE' ? 'destructive' : 'outline'} size="sm"
                onClick={() => !isValidated && setWeightMode('PANNE_BASCULE')} disabled={isValidated}
                className="text-xs gap-1">
                <WifiOff className="h-3 w-3" />Panne (RG-R08)
              </Button>
            </div>
          </div>

          {/* RG-R08 banner */}
          {weightMode === 'PANNE_BASCULE' && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <span className="font-semibold">RG-R08 — Protocole panne pont-bascule :</span> saisie manuelle autorisée uniquement avec description de panne (≥20 car.), superviseur + 2 témoins distincts. L'écart sera signalé à la direction.
            </div>
          )}

          {/* Weight Display */}
          <div className="text-center py-6 bg-background rounded-xl border">
            <div className="text-5xl font-black tabular-nums">
              {currentWeight.toFixed(2)}
              <span className="text-xl text-muted-foreground ml-2">KG</span>
            </div>
            <div className="mt-2">
              <Badge variant={isValidated ? 'default' : (weightMode === 'SCALE' && isStable) ? 'secondary' : 'outline'}>
                {isValidated ? (
                  <><Lock className="h-3 w-3 mr-1" />VALEUR BLOQUÉE</>
                ) : weightMode === 'SCALE' && isStable ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />Poids Stabilisé</>
                ) : weightMode === 'SCALE' ? (
                  'Stabilisation...'
                ) : weightMode === 'PANNE_BASCULE' ? (
                  <><WifiOff className="h-3 w-3 mr-1" />PANNE BASCULE — saisie forcée</>
                ) : (
                  'Saisie manuelle'
                )}
              </Badge>
            </div>
          </div>

          {/* Manual / Panne weight input */}
          {(weightMode === 'MANUAL' || weightMode === 'PANNE_BASCULE') && !isValidated && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Poids Brut saisi manuellement (kg)</Label>
                <Input type="number" value={manualWeight} onChange={(e) => setManualWeight(e.target.value)}
                  placeholder="0.00" className="text-center text-2xl font-bold" />
              </div>
              <div className="space-y-1">
                <Label>
                  {weightMode === 'PANNE_BASCULE'
                    ? 'Description de la panne (≥ 20 caractères) — RG-R08'
                    : 'Motif override manuel (≥ 10 caractères)'}
                </Label>
                <Input value={manualReason} onChange={(e) => setManualReason(e.target.value)}
                  placeholder={weightMode === 'PANNE_BASCULE' ? 'Ex: rupture câble RS-485 port COM3 — vérifié à 14h32' : 'Ex: panne liaison pont-bascule'} />
              </div>
            </div>
          )}

          {/* RG-R08 witness fields */}
          {weightMode === 'PANNE_BASCULE' && !isValidated && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-semibold text-red-700 mb-2">Témoins obligatoires — RG-R08</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Témoin 1 (nom complet)</Label>
                  <Input value={witness1} onChange={(e) => setWitness1(e.target.value)}
                    placeholder="Témoin 1..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Témoin 2 (nom complet)</Label>
                  <Input value={witness2} onChange={(e) => setWitness2(e.target.value)}
                    placeholder="Témoin 2..." />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Validation section */}
      <Card className={isValidated ? 'border-primary bg-primary/5' : weightMode === 'PANNE_BASCULE' ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'}>
        <CardContent className="p-4">
          {!isValidated ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${weightMode === 'PANNE_BASCULE' ? 'bg-red-100' : 'bg-orange-100'}`}>
                  <AlertTriangle className={`h-5 w-5 ${weightMode === 'PANNE_BASCULE' ? 'text-red-600' : 'text-orange-600'}`} />
                </div>
                <div>
                  <p className="font-semibold">Contrôle de Poids Brut Requis</p>
                  <p className="text-sm text-muted-foreground">
                    {weightMode === 'PANNE_BASCULE' ? 'Signature superviseur + 2 témoins — RG-R08' : 'Signature superviseur obligatoire'}
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto">EN ATTENTE</Badge>
              </div>

              <div className="space-y-2">
                <Label>Nom du Superviseur</Label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="Identité Superviseur..." className="pl-10" />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />{error}
                </p>
              )}

              <Button onClick={handleValidate} className="w-full" size="lg"
                variant={weightMode === 'PANNE_BASCULE' ? 'destructive' : 'default'}>
                <Lock className="h-4 w-4 mr-2" />
                {weightMode === 'PANNE_BASCULE' ? 'Valider — Poids forcé (RG-R08)' : 'Valider le Poids Brut'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-full">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary">CERTIFIÉ</Badge>
                    {validationMeta?.witness1 && (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[0.6rem]">
                        PANNE RG-R08
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">{validationMeta?.time}</span>
                  </div>
                  <p className="text-2xl font-black mt-1">{validationMeta?.weight.toLocaleString()} Kg Validés</p>
                  <p className="text-sm text-muted-foreground">Superviseur: {validationMeta?.supervisor}</p>
                  <p className="text-xs text-muted-foreground">
                    Source: {validationMeta?.source === 'MANUAL' ? 'Saisie manuelle' : 'Pont-bascule'}
                  </p>
                  {validationMeta?.manualReason && (
                    <p className="text-xs text-muted-foreground">Motif: {validationMeta.manualReason}</p>
                  )}
                  {validationMeta?.witness1 && (
                    <p className="text-xs text-muted-foreground">
                      Témoins: {validationMeta.witness1} / {validationMeta.witness2}
                    </p>
                  )}
                </div>
              </div>

              <Button variant="outline" onClick={onWeightReset} className="w-full">
                <Unlock className="h-4 w-4 mr-2" />Débloquer pour Correction
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
