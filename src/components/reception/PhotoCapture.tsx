import { useRef, useState } from 'react';
import { Camera, Image, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  title?: string;
}

const SLOT_HINTS = ['Vue ensemble', 'Gros plan', 'Anomalie', 'Étiquette BL'];

export const PhotoCapture = ({
  photos,
  onPhotosChange,
  maxPhotos = 3,
}: PhotoCaptureProps) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || photos.length >= maxPhotos) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const next = [...photos, dataUrl];
    onPhotosChange(next);
    if (next.length >= maxPhotos) stopCamera();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remainingSlots = maxPhotos - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    // Batch all reads so we don't overwrite with stale closure
    Promise.all(
      filesToProcess.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((dataUrls) => onPhotosChange([...photos, ...dataUrls]));
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      {/* ── Camera feed or action buttons ── */}
      {isCameraActive ? (
        <div className="relative overflow-hidden rounded-2xl border bg-black">
          <video
            ref={videoRef}
            className="w-full object-cover"
            style={{ maxHeight: 200 }}
            playsInline
            muted
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent pb-4 pt-10">
            <Button
              size="sm"
              className="rounded-xl shadow-md"
              onClick={capturePhoto}
              disabled={!canAddMore}
            >
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Capturer
            </Button>
            <Button size="sm" variant="secondary" className="rounded-xl" onClick={stopCamera}>
              Fermer
            </Button>
          </div>
        </div>
      ) : canAddMore ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={startCamera}
          >
            <Camera className="mr-2 h-4 w-4" />
            Caméra
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700">
          ✓ {maxPhotos} photos capturées
        </div>
      )}

      {/* ── Photo slot grid ── */}
      <div className={cn('grid gap-2', maxPhotos === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
        {Array.from({ length: maxPhotos }).map((_, index) => {
          const hasPhoto = !!photos[index];
          return (
            <div
              key={index}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-xl border-2 transition-colors',
                hasPhoto
                  ? 'border-transparent'
                  : 'cursor-pointer border-dashed border-border hover:border-primary/40 hover:bg-primary/5',
              )}
              onClick={() => !hasPhoto && !isCameraActive && fileInputRef.current?.click()}
            >
              {/* Slot number badge */}
              <div className={cn(
                'absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                hasPhoto ? 'bg-black/40 text-white' : 'bg-muted-foreground/15 text-muted-foreground',
              )}>
                {index + 1}
              </div>

              {hasPhoto ? (
                <>
                  <img
                    src={photos[index]}
                    alt={`Photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                    className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/50">
                  <Image className="h-5 w-5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Slot hint pills ── */}
      <div className="flex flex-wrap gap-1.5">
        {SLOT_HINTS.slice(0, maxPhotos).map((hint, i) => (
          <span
            key={i}
            className={cn(
              'rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-colors',
              photos[i]
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-border text-muted-foreground/60',
            )}
          >
            {i + 1}. {hint}
          </span>
        ))}
      </div>

      {/* ── Hidden elements ── */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};
