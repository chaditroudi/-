/**
 * Gs1LabelPreview — T-201 / T-202 / T-204
 * Affiche le payload GS1 généré par POST /reception-lots/:id/label.
 * Permet la ré-impression depuis le même bouton.
 */

import { useState } from 'react';
import { QrCode, Printer, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useGenerateLotLabel } from '@/hooks/useWeighing';
import type { Gs1LabelPayload } from '@/hooks/useWeighing';
import type { ReceptionLot } from '@/types/reception';

interface Gs1LabelPreviewProps {
  lot: ReceptionLot;
  onClose: () => void;
}

function AiRow({ ai, value, label }: { ai: string; value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-primary font-bold">{ai}</code>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono">{value}</code>
        <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function Gs1LabelPreview({ lot, onClose }: Gs1LabelPreviewProps) {
  const { mutate: generateLabel, isPending } = useGenerateLotLabel();
  const [payload, setPayload] = useState<Gs1LabelPayload | null>(null);

  const handleGenerate = async () => {
    const result = await generateLabel(lot.id);
    if (result) setPayload(result);
  };

  const handlePrint = () => {
    if (!payload) return;
    const win = window.open('', '_blank', 'width=600,height=400');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Étiquette ${payload.lot_code}</title>
      <style>
        body { font-family: monospace; padding: 20px; font-size: 12px; }
        h2 { font-size: 16px; } 
        .barcode { font-size: 22px; letter-spacing: 4px; margin: 10px 0; border: 1px solid #000; padding: 8px; display: inline-block; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        td { padding: 4px 8px; border: 1px solid #ddd; }
        td:first-child { font-weight: bold; background: #f5f5f5; width: 40%; }
        @media print { button { display: none; } }
      </style>
      </head><body>
      <h2>Étiquette GS1 — ${payload.lot_code}</h2>
      <div class="barcode">${payload.gs1_128}</div>
      <table>
        <tr><td>GTIN-14 (AI 01)</td><td>${payload.gtin14}</td></tr>
        <tr><td>Lot/Batch (AI 10)</td><td>${payload.lot_code}</td></tr>
        <tr><td>Poids net (AI 3103)</td><td>${(payload.net_weight_g / 1000).toFixed(3)} kg</td></tr>
        <tr><td>DataMatrix</td><td style="font-size:10px;word-break:break-all">${payload.datamatrix}</td></tr>
        <tr><td>Imprimé le</td><td>${new Date(payload.printed_at).toLocaleString('fr-FR')}</td></tr>
      </table>
      <br/><button onclick="window.print()">Imprimer</button>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            Étiquette GS1 — {(lot as any).lot_internal ?? lot.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            Génère le payload GS1-128 et DataMatrix pour l'étiquette physique du lot.
          </DialogDescription>
        </DialogHeader>

        {!payload ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <QrCode className="h-16 w-16 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground text-center">
              Aucune étiquette générée pour ce lot.
              {(lot as any).label_printed_at && (
                <span className="block mt-1 text-xs text-emerald-600">
                  Dernière impression : {new Date((lot as any).label_printed_at).toLocaleString('fr-FR')}
                </span>
              )}
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Génération…</>
              ) : (
                <><QrCode className="h-4 w-4 mr-2" />
                {(lot as { label_printed_at?: string }).label_printed_at ? "Ré-imprimer" : "Générer l'étiquette"}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* GS1-128 string preview */}
            <div className="bg-muted/40 rounded-lg p-3 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">GS1-128</p>
              <code className="text-xs font-mono break-all text-foreground">{payload.gs1_128}</code>
            </div>

            {/* AI breakdown */}
            <div className="rounded-lg border p-3 space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Application Identifiers
              </p>
              <AiRow ai="(01)" value={payload.gtin14} label="GTIN-14" />
              <AiRow ai="(10)" value={payload.lot_code} label="Lot / Batch" />
              <AiRow
                ai="(3103)"
                value={String(payload.net_weight_g).padStart(6, '0')}
                label={`Poids net — ${(payload.net_weight_g / 1000).toFixed(3)} kg`}
              />
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Enregistré {new Date(payload.printed_at).toLocaleString('fr-FR')}
              </Badge>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${isPending ? 'animate-spin' : ''}`} />
                Ré-générer
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimer l'étiquette
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
