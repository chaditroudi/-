import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface RestrictedScreenProps {
  title?: string;
  onLeave?: () => void;
  leaveLabel?: string;
}

/** Reached by a link or a typed address: it says why, instead of quietly moving the employee. */
export const RestrictedScreen = ({ title, onLeave, leaveLabel = "Revenir à l'accueil" }: RestrictedScreenProps) => (
  <div className="mx-auto max-w-md p-4">
    <div role="status" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h2 className="text-base">{title ? `${title} : accès réservé` : 'Accès réservé'}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Votre rôle ne donne pas accès à cet écran. Votre responsable peut demander cet accès.
      </p>
      {onLeave && (
        <div className="flex justify-end">
          <Button type="button" onClick={onLeave}>{leaveLabel}</Button>
        </div>
      )}
    </div>
  </div>
);
