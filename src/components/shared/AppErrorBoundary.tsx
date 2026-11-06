import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Remount when this changes, so moving to another screen clears a crash. */
  resetKey?: string;
  /** Around one screen rather than the whole application. */
  scoped?: boolean;
}

/**
 * A crash in one screen stops at this screen. Queued receptions and drafts live in
 * IndexedDB, so nothing an employee has confirmed is lost by reloading.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed:', error, info.componentStack);
  }

  componentDidUpdate(previous: AppErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className={this.props.scoped ? 'p-4' : 'flex min-h-screen items-center justify-center bg-background p-4'}>
        <div role="alert" className="w-full max-w-md space-y-3 rounded-lg border border-destructive/40 bg-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            <h1 className="text-base">Cet écran a rencontré un problème</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Rechargez pour reprendre. Les réceptions déjà confirmées et les brouillons sont conservés sur cet appareil.
          </p>
          <div className="flex justify-end gap-2">
            {this.props.scoped && (
              <Button type="button" variant="outline" onClick={() => this.setState({ failed: false })}>Réessayer</Button>
            )}
            <Button type="button" onClick={() => window.location.reload()}>Recharger</Button>
          </div>
        </div>
      </div>
    );
  }
}
