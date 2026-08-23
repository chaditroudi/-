import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/integrations/mongodb/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';

/** Self-service: set your own numeric signature PIN (password required). */
export function SignaturePinSelfPanel() {
  const { user, refreshSession } = useAuth();
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  if (!user) return null;

  const save = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('Le code signature doit contenir 4 à 6 chiffres.');
      return;
    }
    if (pin !== confirm) {
      toast.error('Les deux codes ne correspondent pas.');
      return;
    }
    if (!password) {
      toast.error('Mot de passe requis pour définir le code.');
      return;
    }
    setPending(true);
    try {
      await apiRequest('/auth/signature-pin', {
        method: 'POST',
        body: JSON.stringify({ pin, password }),
      });
      toast.success('Code signature enregistré');
      setPassword('');
      setPin('');
      setConfirm('');
      await refreshSession();
    } catch (err: any) {
      toast.error(err?.message ?? 'Impossible d’enregistrer le code.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Mon code signature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          PIN 4–6 chiffres pour les visas CCP (fumigation, etc.). Distinct du mot de passe de connexion.
          {user.has_signature_pin ? ' — PIN déjà configuré.' : ' — aucun PIN pour le moment.'}
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Mot de passe compte</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nouveau PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirmer</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Enregistrer mon PIN
        </Button>
      </CardContent>
    </Card>
  );
}
