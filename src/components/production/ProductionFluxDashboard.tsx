/**
 * ProductionFluxDashboard
 *
 * Top-level tabbed container for the production tab's flux-related panels.
 * Aligns with "Cartographie complète des flux de production" v3.0.
 *
 * Tabs:
 *   1. Flux F1–F8       — ProductionLinesPanel (8-line visual map)
 *   2. Bilan matière    — MaterialBalancePanel (PDF p.4)
 *   3. HACCP            — HaccpDashboard (PDF p.16)
 *   4. KPI globaux      — ProductionKpiPanel (PDF p.17)
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ProductionLinesPanel } from './ProductionLinesPanel';
import { MaterialBalancePanel } from './MaterialBalancePanel';
import { HaccpDashboard } from './HaccpDashboard';
import { ProductionKpiPanel } from './ProductionKpiPanel';
import {
  BarChart3,
  FlaskConical,
  GitMerge,
  ShieldAlert,
} from 'lucide-react';

type FluxTab = 'lines' | 'balance' | 'haccp' | 'kpi';

interface TabDef {
  id: FluxTab;
  label: string;
  shortLabel: string;
  icon: typeof BarChart3;
  badge?: string;
}

const TABS: TabDef[] = [
  { id: 'lines',   label: 'Flux F1–F8',     shortLabel: 'Flux',    icon: GitMerge,   badge: '8 lignes' },
  { id: 'balance', label: 'Bilan matière',  shortLabel: 'Bilan',   icon: FlaskConical },
  { id: 'haccp',   label: 'Plan HACCP',     shortLabel: 'HACCP',   icon: ShieldAlert, badge: 'CCP1·CCP2' },
  { id: 'kpi',     label: 'KPI globaux',    shortLabel: 'KPI',     icon: BarChart3,   badge: '16 indicateurs' },
];

export function ProductionFluxDashboard() {
  const [activeTab, setActiveTab] = useState<FluxTab>('lines');

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest">
            Dossier industriel v3.0
          </Badge>
          <span className="text-xs text-muted-foreground">
            Usine Royal Palm · Tozeur · Tunisie
          </span>
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          Cartographie complète des flux de production
        </h2>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {tab.badge && (
                <Badge
                  variant="outline"
                  className={cn(
                    'hidden rounded-full px-1.5 py-0 text-[11px] font-semibold lg:inline-flex',
                    isActive && 'border-primary/30 bg-primary/10 text-primary',
                  )}
                >
                  {tab.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'lines'   && <ProductionLinesPanel />}
        {activeTab === 'balance' && <MaterialBalancePanel />}
        {activeTab === 'haccp'   && <HaccpDashboard />}
        {activeTab === 'kpi'     && <ProductionKpiPanel />}
      </div>
    </div>
  );
}
