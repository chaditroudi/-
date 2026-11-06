import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Delete, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;
const MAX_LEN = 6;

type PadProps = {
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  pending?: boolean;
  onCancel?: () => void;
  onConfirm: (pin: string) => void | Promise<void>;
};

/** Numpad body — safe to embed inside an existing dialog. */
export function NumericSignaturePad({
  title,
  subtitle,
  confirmLabel = 'Signer',
  pending = false,
  onCancel,
  onConfirm,
}: PadProps) {
  const [pin, setPin] = useState('');

  const pushDigit = (digit: string) => {
    setPin((prev) => (prev.length >= MAX_LEN ? prev : prev + digit));
  };

  const handleConfirm = async () => {
    if (pin.length < 4 || pending) return;
    await onConfirm(pin);
    setPin('');
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          {title}
        </div>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>

      <div className="flex justify-center gap-2 py-1" aria-label="Code saisi">
        {Array.from({ length: MAX_LEN }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-3 rounded-full border',
              i < pin.length ? 'bg-emerald-700 border-emerald-700' : 'border-muted-foreground/40',
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
        {KEYS.map((key, idx) => {
          if (key === '') return <span key={`empty-${idx}`} />;
          if (key === 'back') {
            return (
              <Button
                key="back"
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setPin((p) => p.slice(0, -1))}
                disabled={pending || pin.length === 0}
              >
                <Delete className="h-4 w-4" />
              </Button>
            );
          }
          return (
            <Button
              key={key}
              type="button"
              variant="secondary"
              className="h-11 text-lg font-semibold"
              onClick={() => pushDigit(key)}
              disabled={pending || pin.length >= MAX_LEN}
            >
              {key}
            </Button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Code signature à 4–6 chiffres (personnel)
      </p>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={() => void handleConfirm()} disabled={pending || pin.length < 4}>
          {pending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export type NumericSignatureDialogProps = PadProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Standalone dialog wrapper for pages that are not already in a Dialog. */
export function NumericSignatureDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  confirmLabel = 'Signer',
  pending = false,
  onConfirm,
}: NumericSignatureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
        </DialogHeader>
        {open ? (
          <NumericSignaturePad
            key="pad"
            title={title}
            subtitle={subtitle}
            confirmLabel={confirmLabel}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
