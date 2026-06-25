import { useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, QrCode } from 'lucide-react';
import { ReceptionUnit, ReceptionV2, ReceptionLot, stockStatusLabels, unitTypeLabels } from '@/types/reception';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMarkReceptionUnitPrinted } from '@/hooks/useReceptionsV2';

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: ReceptionUnit | null;
  reception: ReceptionV2;
  lot: ReceptionLot | null;
}

const buildQrPayloadFallback = (unit: ReceptionUnit, reception: ReceptionV2, lot: ReceptionLot) =>
  JSON.stringify({
    lot_id: lot.lot_internal || lot.id,
    reception_number: reception.reception_number,
    unit_barcode: unit.barcode,
    quantity: unit.quantity,
    unit: unit.unit,
    storage_zone_code: reception.storage_zone_code || null,
  });

const formatQrPayloadPreview = (qrPayload: string) => {
  try {
    const parsed = JSON.parse(qrPayload) as Record<string, unknown>;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return qrPayload;
    }

    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${value == null ? 'null' : String(value)}`)
      .join('\n');
  } catch {
    return qrPayload;
  }
};

export const LabelPrintDialog = ({ open, onOpenChange, unit, reception, lot }: LabelPrintDialogProps) => {
  const labelRef = useRef<HTMLDivElement>(null);
  const markPrinted = useMarkReceptionUnitPrinted();

  if (!unit || !lot) return null;

  const qrPayload = useMemo(
    () =>
      unit.qr_code_payload?.trim() ||
      unit.qr_label_text?.trim() ||
      lot.qr_code_payload?.trim() ||
      buildQrPayloadFallback(unit, reception, lot),
    [lot, reception, unit],
  );

  const qrPayloadPreview = useMemo(() => formatQrPayloadPreview(qrPayload), [qrPayload]);
  const qrCaption = unit.qr_label_text?.trim() || `${unit.barcode} | ${unit.quantity} ${unit.unit}`;
  const receptionDate = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const lastPrintedAt = unit.label_printed_at
    ? format(new Date(unit.label_printed_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    : null;

  const handlePrint = async () => {
    const printContent = labelRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Étiquette ${unit.barcode}</title>
          <style>
            @page { size: 100mm 150mm; margin: 5mm; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 10px;
            }
            .label-container {
              border: 2px solid #000;
              padding: 10px;
              width: 90mm;
            }
            .label-sheet {
              border: 2px solid #111;
              border-radius: 14px;
              padding: 14px;
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .header h1 {
              margin: 0;
              font-size: 16px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin: 4px 0;
              font-size: 11px;
            }
            .row .label {
              color: #666;
            }
            .row .value {
              font-weight: bold;
            }
            .barcode-section {
              text-align: center;
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #000;
            }
            .barcode {
              font-family: 'Libre Barcode 39', monospace;
              font-size: 40px;
              letter-spacing: 2px;
            }
            .barcode-text {
              font-size: 12px;
              margin-top: 4px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 12px;
              margin-top: 8px;
            }
            .status-libere { background: #22c55e; color: white; }
            .status-quarantaine { background: #f97316; color: white; }
            .status-rejete { background: #ef4444; color: white; }
            .status-non-stocke { background: #6b7280; color: white; }
            .qr-section {
              text-align: center;
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #000;
            }
            .qr-code {
              display: flex;
              justify-content: center;
              margin: 8px 0 10px;
            }
            .qr-code svg {
              width: 96px;
              height: 96px;
              display: block;
            }
            .qr-caption {
              font-size: 10px;
              color: #444;
              margin-bottom: 8px;
            }
            .meta-note {
              font-size: 10px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    try {
      await markPrinted.mutateAsync(unit.id);
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusClass = () => {
    switch (unit.unit_status) {
      case 'STOCK_LIBERE': return 'status-libere';
      case 'EN_QUARANTAINE': return 'status-quarantaine';
      case 'STOCK_REJETE': return 'status-rejete';
      default: return 'status-non-stocke';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Aperçu Étiquette QR
          </DialogTitle>
        </DialogHeader>

        {/* Label Preview */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div ref={labelRef} className="label-container">
              <Card className="label-sheet border-2 border-foreground">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="header text-center border-b pb-3">
                  <h1 className="font-bold text-lg">{reception.supplier?.name || 'Fournisseur'}</h1>
                  <p className="text-sm text-muted-foreground">{reception.reception_type}</p>
                </div>

                {/* Info Rows */}
                <div className="space-y-2 text-sm">
                  <div className="row flex justify-between">
                    <span className="label text-muted-foreground">Réception:</span>
                    <span className="value font-medium">{reception.reception_number}</span>
                  </div>
                  <div className="row flex justify-between">
                    <span className="label text-muted-foreground">Lot interne:</span>
                    <span className="value font-medium">{lot.lot_internal}</span>
                  </div>
                  <div className="row flex justify-between">
                    <span className="label text-muted-foreground">Lot fournisseur:</span>
                    <span className="value font-medium">{lot.lot_supplier}</span>
                  </div>
                  <Separator />
                  <div className="row flex justify-between">
                    <span className="label text-muted-foreground">Type:</span>
                    <span className="value font-medium">{unitTypeLabels[unit.unit_type]}</span>
                  </div>
                  <div className="row flex justify-between">
                    <span className="label text-muted-foreground">Quantité:</span>
                    <span className="value font-medium">{unit.quantity} {unit.unit}</span>
                  </div>
                  {unit.net_weight && (
                    <div className="row flex justify-between">
                      <span className="label text-muted-foreground">Poids net:</span>
                      <span className="value font-medium">{unit.net_weight} kg</span>
                    </div>
                  )}
                  <div className="row flex justify-between">
                    <span className="label text-muted-foreground">Date réception:</span>
                    <span className="value font-medium">{receptionDate}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="text-center">
                  <Badge className={`status-badge ${getStatusClass()} text-white px-4 py-1 text-sm`}>
                    {stockStatusLabels[unit.unit_status]}
                  </Badge>
                </div>

                {/* QR Section */}
                <div className="qr-section">
                  <div className="qr-code">
                    <QRCodeSVG
                      value={qrPayload}
                      size={112}
                      level="M"
                      marginSize={2}
                      includeMargin={false}
                    />
                  </div>
                  <p className="qr-caption font-medium">{qrCaption}</p>
                  <p className="barcode-text font-mono text-lg font-bold">{unit.barcode}</p>
                  {unit.sscc && (
                    <p className="text-xs text-muted-foreground mt-1">SSCC: {unit.sscc}</p>
                  )}
                  <p className="meta-note mt-2">Scanner pour accéder à la traçabilité de l'unité</p>
                </div>
              </CardContent>
              </Card>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/25 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4 text-emerald-600" />
              Contenu du QR
            </div>
            <div className="mt-3 rounded-lg bg-background p-3 font-mono text-xs leading-5 text-muted-foreground whitespace-pre-wrap break-all">
              {qrPayloadPreview}
            </div>
            {lastPrintedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Dernière impression enregistrée : {lastPrintedAt}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
