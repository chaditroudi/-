import { cn } from '@/lib/utils';

interface AppLoaderProps {
  className?: string;
  title?: string;
}

export function AppLoader({ className, title = 'Préparation de votre espace…' }: AppLoaderProps) {
  return (
    <div role="status" className={cn('flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground', className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden />
      {title}
    </div>
  );
}
