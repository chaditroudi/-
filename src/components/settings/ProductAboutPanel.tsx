import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PRODUCT } from '@/lib/productMeta';
import { runDemoSeasonInApp } from '@/lib/demoSeason';
import { BookOpen, Loader2, PackageCheck, Play, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthContext } from '@/contexts/AuthContext';

interface ProductAboutPanelProps {
  onOpenFiches?: () => void;
}

/** Buyer / admin facing product identity — settings & handoff. */
export function ProductAboutPanel({ onOpenFiches }: ProductAboutPanelProps) {
  const { isAdmin } = useAuthContext();
  const [demoBusy, setDemoBusy] = useState(false);

  const runDemo = async () => {
    setDemoBusy(true);
    try {
      const result = await runDemoSeasonInApp();
      toast.success(`Lot démo ${result.lotNumber} prêt — fil d'or complet`);
      window.open(result.passportPath, '_blank');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Demo season impossible');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <Card className="rounded-lg border-primary/20">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            v{PRODUCT.version}
          </Badge>
          <Badge variant="secondary">{PRODUCT.edition}</Badge>
        </div>
        <CardTitle className="mt-2 text-xl">{PRODUCT.commercialName}</CardTitle>
        <CardDescription>{PRODUCT.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {PRODUCT.pillars.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Inclus dans cette édition
          </p>
          <p className="mt-1">{PRODUCT.waves.join(' · ')}</p>
          <p className="mt-1">Stack : {PRODUCT.stack}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenFiches && (
            <Button type="button" variant="outline" className="gap-2" onClick={onOpenFiches}>
              <BookOpen className="h-4 w-4" />
              Fiches A→Z
            </Button>
          )}
          {isAdmin && import.meta.env.DEV && (
            <Button type="button" className="gap-2" disabled={demoBusy} onClick={() => void runDemo()}>
              {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Demo season A→Z
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          CLI : <code className="rounded bg-muted px-1">npm run demo:season</code>
          {' · '}
          Edge : PWA + outbox · <code className="rounded bg-muted px-1">weighbridge:sim</code>
          {' · '}
          Next : ATP deepen (lines/OEE) · SMTP later · GS1 réel
        </p>
        <p className="text-[11px] text-muted-foreground">
          {PRODUCT.name} © {PRODUCT.year} — licence commerciale. Personnalisez marque et logo dans
          Paramètres → Marque.
        </p>
      </CardContent>
    </Card>
  );
}
