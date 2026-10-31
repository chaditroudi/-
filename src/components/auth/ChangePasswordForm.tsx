import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthContext } from '@/contexts/AuthContext';

const MIN_PASSWORD_LENGTH = 10;

interface ChangePasswordFormProps {
  onDone?: () => void;
}

export function ChangePasswordForm({ onDone }: ChangePasswordFormProps) {
  const { changePassword } = useAuthContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (newPassword !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de changer le mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Mot de passe actuel</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Nouveau mot de passe</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Au moins {MIN_PASSWORD_LENGTH} caractères.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full gap-2" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
