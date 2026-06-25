import { useRef } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TriageSubLot } from '@/types/phase2';
import { Printer } from 'lucide-react';

const DESTINATION_LABEL: Record<string, string> = {
  CONDITIONNEMENT_PREMIUM: 'Conditionnement Premium',
  CONDITIONNEMENT_STANDARD: 'Conditionnement Standard',
  TRANSFORMATION: 'Transformation',
  DESTRUCTION: 'Destruction',
};

const GRADE_LABEL: Record<string, string> = {
  EXTRA: 'EXTRA',
  CATEGORIE_I: 'CATÉGORIE I',
  CATEGORIE_II: 'CATÉGORIE II',
  REJETE: 'REJETÉ',
};

const GRADE_BG: Record<string, string> = {
  EXTRA: '#dcfce7',
  CATEGORIE_I: '#dbeafe',
  CATEGORIE_II: '#fef9c3',
  REJETE: '#fee2e2',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subLots: TriageSubLot[];
  sessionNumber: string;
}

export function SubLotLabelPrintDialog({ open, onOpenChange, subLots, sessionNumber }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printArea = printRef.current;
    if (!printArea) return;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les popups.");
      return;
    }
    win.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquettes sous-lots — ${sessionNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; }
    .labels { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; }
    .label { width: 90mm; border: 2px solid #333; border-radius: 4px; padding: 8px; break-inside: avoid; }
    .label-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #555; margin-bottom: 4px; }
    .grade { font-size: 18px; font-weight: 900; margin-bottom: 4px; }
    .lot-number { font-family: monospace; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
    .details { font-size: 11px; color: #333; margin-bottom: 6px; }
    .details div { margin-bottom: 2px; }
    .qr-row { display: flex; justify-content: center; margin-top: 6px; }
    .footer { font-size: 9px; color: #888; margin-top: 4px; text-align: center; }
    @media print {
      body { margin: 0; }
      .labels { padding: 0; gap: 4px; }
    }
  </style>
</head>
<body>
  <div class="labels">
    ${subLots.map((sl) => `
    <div class="label" style="border-color: ${GRADE_BG[sl.grade]};">
      <div class="label-header">Sous-lot triage — Royal Palm</div>
      <div class="grade" style="color: #111; background: ${GRADE_BG[sl.grade]}; padding: 2px 6px; border-radius: 3px; display: inline-block;">${GRADE_LABEL[sl.grade]}</div>
      <div class="lot-number">${sl.lot_number}</div>
      <div class="details">
        <div>Lot parent: ${sl.parent_lot_number}</div>
        <div>Poids: <strong>${sl.weight_kg} kg</strong> (${sl.percent_of_parent}% du lot)</div>
        <div>Destination: ${DESTINATION_LABEL[sl.destination] ?? sl.destination}</div>
        <div>Créé: ${new Date(sl.created_at).toLocaleString('fr-FR')}</div>
      </div>
      <div class="footer">MES Royal Palm Phase 2 — Scanner pour traçabilité</div>
    </div>
    `).join('')}
  </div>
  <script>setTimeout(function(){window.print();},300);</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Étiquettes sous-lots — {sessionNumber}</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-3">
          {subLots.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Aucun sous-lot à imprimer. Clôturez la session d'abord.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {subLots.map((sl) => (
                <div
                  key={sl.id}
                  className="border-2 rounded-lg p-3 space-y-2"
                  style={{ borderColor: GRADE_BG[sl.grade] }}
                >
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Sous-lot triage — Royal Palm
                  </div>
                  <div
                    className="inline-block text-lg font-black px-2 py-0.5 rounded text-gray-900"
                    style={{ background: GRADE_BG[sl.grade] }}
                  >
                    {GRADE_LABEL[sl.grade]}
                  </div>
                  <div className="font-mono font-bold text-sm">{sl.lot_number}</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Lot parent: {sl.parent_lot_number}</div>
                    <div>Poids: <strong>{sl.weight_kg} kg</strong> ({sl.percent_of_parent}% du lot)</div>
                    <div>Destination: {DESTINATION_LABEL[sl.destination] ?? sl.destination}</div>
                  </div>
                  <div className="flex justify-center pt-1">
                    <QRCode
                      value={JSON.stringify({
                        lot: sl.lot_number,
                        grade: sl.grade,
                        weight_kg: sl.weight_kg,
                        destination: sl.destination,
                        parent: sl.parent_lot_number,
                      })}
                      size={96}
                      level="M"
                      marginSize={2}
                    />
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    MES Royal Palm Phase 2
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
          {subLots.length > 0 && (
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimer {subLots.length} étiquette{subLots.length > 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
