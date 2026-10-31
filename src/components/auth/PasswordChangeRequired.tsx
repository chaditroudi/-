import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Shown instead of the app until the account has replaced its first password. */
export function PasswordChangeRequired() {
  const { signOut } = useAuthContext();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Changez votre mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            Ce compte utilise encore son mot de passe initial. Choisissez-en un nouveau pour continuer.
          </p>
        </div>
        <ChangePasswordForm />
        <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
