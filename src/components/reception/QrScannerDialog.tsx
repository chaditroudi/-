import { useEffect, useRef, useState } from 'react';
import { Camera, QrCode, ScanLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
}

export const QrScannerDialog = ({ open, onOpenChange, onDetected }: QrScannerDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDetectionAtRef = useRef(0);

  const [isStarting, setIsStarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Positionnez le QR code du lot dans le cadre.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopScanner = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setErrorMessage(null);
      setStatusMessage('Positionnez le QR code du lot dans le cadre.');
      return;
    }

    const startScanner = async () => {
      setIsStarting(true);
      setErrorMessage(null);

      if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('La caméra n’est pas disponible sur cet appareil. Utilisez la saisie manuelle du LOT-ID.');
        setIsStarting(false);
        return;
      }

      if (!('BarcodeDetector' in window)) {
        setErrorMessage('Le scan caméra n’est pas supporté par ce navigateur. Utilisez la saisie manuelle du LOT-ID.');
        setIsStarting(false);
        return;
      }

      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detectFrame = async () => {
          const video = videoRef.current;
          const detector = detectorRef.current;

          if (!video || !detector || video.readyState < 2) {
            animationFrameRef.current = requestAnimationFrame(() => {
              void detectFrame();
            });
            return;
          }

          const now = Date.now();
          if (now - lastDetectionAtRef.current < 250) {
            animationFrameRef.current = requestAnimationFrame(() => {
              void detectFrame();
            });
            return;
          }

          lastDetectionAtRef.current = now;

          try {
            const barcodes = await detector.detect(video);
            const firstMatch = barcodes.find((barcode) => barcode.rawValue?.trim());

            if (firstMatch?.rawValue) {
              setStatusMessage('Code détecté. Chargement du lot...');
              stopScanner();
              onDetected(firstMatch.rawValue);
              onOpenChange(false);
              return;
            }
          } catch (error) {
            console.error('QR detection error:', error);
          }

          animationFrameRef.current = requestAnimationFrame(() => {
            void detectFrame();
          });
        };

        setStatusMessage('Positionnez le QR code du lot dans le cadre.');
        animationFrameRef.current = requestAnimationFrame(() => {
          void detectFrame();
        });
      } catch (error) {
        console.error('Camera start error:', error);
        setErrorMessage('Impossible d’ouvrir la caméra. Vérifiez l’autorisation puis réessayez.');
      } finally {
        setIsStarting(false);
      }
    };

    void startScanner();

    return () => {
      stopScanner();
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Scanner QR du lot
          </DialogTitle>
          <DialogDescription>
            Utilisez la caméra arrière du téléphone pour lire le QR code et charger automatiquement les informations du lot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-slate-950">
            <div className="aspect-[4/3] w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-48 w-48 rounded-[28px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)]">
                <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
              </div>
            </div>

            <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <span className="inline-flex items-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5" />
                {isStarting ? 'Initialisation caméra...' : 'Cadrez le QR code'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm">
            <p className="font-medium text-foreground">Conseil</p>
            <p className="mt-2 leading-6 text-muted-foreground">
              Tenez le téléphone à 15-25 cm du QR code, avec une lumière suffisante. Si le scan ne démarre pas sur cet appareil, vous pouvez toujours saisir le LOT-ID manuellement.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {errorMessage}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {statusMessage}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>
              <Camera className="mr-2 h-4 w-4" />
              Fermer la caméra
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
