import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  CheckCircle2,
  ChevronRight,
  Droplets,
  FlaskConical,
  Layers,
  Loader2,
  Package,
  PackageCheck,
  Ship,
  Truck,
  Wind,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { phase2Api } from '@/lib/api/phase2';
import type { GenealogyNode, GenealogyEdge, GenealogyNodeType } from '@/lib/api/phase2';

// ── Layout constants ───────────────────────────────────────────────────────────

const NODE_W = 148;
const NODE_H = 72;
const COL_GAP = 80;
const ROW_GAP = 18;
const PAD = 32;

// ── Node visual config ─────────────────────────────────────────────────────────

interface NodeStyle {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
  dot: string;
  label: string;
}

const NODE_STYLE: Record<GenealogyNodeType, NodeStyle> = {
  reception_lot:    { icon: Truck,        bg: 'bg-sky-50',      border: 'border-sky-300',    text: 'text-sky-700',    dot: 'bg-sky-500',     label: 'Lot source' },
  qc_inspection:   { icon: FlaskConical,  bg: 'bg-purple-50',   border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500',  label: 'Inspection QC' },
  fumigation:      { icon: Wind,          bg: 'bg-indigo-50',   border: 'border-indigo-300', text: 'text-indigo-700', dot: 'bg-indigo-500',  label: 'Fumigation' },
  cleaning:        { icon: Droplets,      bg: 'bg-cyan-50',     border: 'border-cyan-300',   text: 'text-cyan-700',   dot: 'bg-cyan-500',    label: 'Nettoyage' },
  hydration:       { icon: Droplets,      bg: 'bg-teal-50',     border: 'border-teal-300',   text: 'text-teal-700',   dot: 'bg-teal-500',    label: 'Hydratation' },
  triage:          { icon: Layers,        bg: 'bg-amber-50',    border: 'border-amber-300',  text: 'text-amber-700',  dot: 'bg-amber-500',   label: 'Triage' },
  sub_lot:         { icon: Box,           bg: 'bg-orange-50',   border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-400',  label: 'Sous-lot' },
  production_order:{ icon: Package,       bg: 'bg-rose-50',     border: 'border-rose-300',   text: 'text-rose-700',   dot: 'bg-rose-500',    label: 'Production' },
  output_lot:      { icon: CheckCircle2,  bg: 'bg-lime-50',     border: 'border-lime-300',   text: 'text-lime-700',   dot: 'bg-lime-500',    label: 'Lot PF' },
  stock_lot:       { icon: Box,           bg: 'bg-green-50',    border: 'border-green-300',  text: 'text-green-700',  dot: 'bg-green-500',   label: 'Stock' },
  packaging_order: { icon: PackageCheck,  bg: 'bg-emerald-50',  border: 'border-emerald-300',text: 'text-emerald-700',dot: 'bg-emerald-500', label: 'Conditionnement' },
  palette:         { icon: PackageCheck,  bg: 'bg-green-100',   border: 'border-green-400',  text: 'text-green-800',  dot: 'bg-green-600',   label: 'Palette' },
  shipment:        { icon: Ship,          bg: 'bg-blue-50',     border: 'border-blue-300',   text: 'text-blue-700',   dot: 'bg-blue-500',    label: 'Expédition' },
};

const STATUS_BADGE: Record<string, string> = {
  COMPLETED:       'bg-emerald-100 text-emerald-700',
  DONE:            'bg-emerald-100 text-emerald-700',
  completed:       'bg-emerald-100 text-emerald-700',
  ACCEPTE:         'bg-emerald-100 text-emerald-700',
  STOCK_LIBERE:    'bg-emerald-100 text-emerald-700',
  PRODUCED:        'bg-emerald-100 text-emerald-700',
  IN_PROGRESS:     'bg-blue-100 text-blue-700',
  in_progress:     'bg-blue-100 text-blue-700',
  EN_COURS:        'bg-blue-100 text-blue-700',
  PENDING:         'bg-slate-100 text-slate-600',
  draft:           'bg-slate-100 text-slate-600',
  DRAFT:           'bg-slate-100 text-slate-600',
  REJETE:          'bg-red-100 text-red-700',
  REJECTED:        'bg-red-100 text-red-700',
  EN_QUARANTAINE:  'bg-amber-100 text-amber-700',
  QUARANTAINE:     'bg-amber-100 text-amber-700',
  CANCELLED:       'bg-red-100 text-red-600',
  cancelled:       'bg-red-100 text-red-600',
};

// ── Formatters ─────────────────────────────────────────────────────────────────

const fmtN = (v: unknown) =>
  typeof v === 'number' ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v) : null;

const fmtDate = (v: unknown) => {
  if (!v || typeof v !== 'string' || v === '') return null;
  try { return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return null; }
};

// ── Detail panel ───────────────────────────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: string | number | null | undefined }) =>
  value != null && value !== '' ? (
    <div className="flex justify-between gap-2 py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right break-all">{String(value)}</span>
    </div>
  ) : null;

const NodeDetail = ({ node }: { node: GenealogyNode }) => {
  const s = NODE_STYLE[node.type];
  const Icon = s.icon;
  const meta = node.meta as Record<string, unknown>;

  const detailRows: Array<[string, unknown]> = Object.entries(meta).filter(
    ([, v]) => v != null && v !== '' && typeof v !== 'object',
  );

  return (
    <div className="space-y-3 min-w-[220px] max-w-[260px]">
      <div className={cn('flex items-center gap-2 p-3 rounded-xl border', s.bg, s.border)}>
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', s.bg)}>
          <Icon className={cn('h-4 w-4', s.text)} />
        </div>
        <div className="min-w-0">
          <p className={cn('text-xs font-bold truncate', s.text)}>{node.label}</p>
          <p className="text-[11px] text-muted-foreground">{s.label}</p>
        </div>
      </div>

      {node.status && (
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_BADGE[node.status] ?? 'bg-gray-100 text-gray-600')}>
          {node.status}
        </span>
      )}

      <div className="space-y-0.5">
        {detailRows.map(([k, v]) => (
          <DetailRow
            key={k}
            label={k.replace(/_/g, ' ')}
            value={k.includes('_at') || k.includes('_date') ? (fmtDate(v) ?? String(v)) : k.includes('_kg') || k.includes('quantity') || k.includes('weight') ? (fmtN(v as number) ?? String(v)) : String(v)}
          />
        ))}
        {detailRows.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">Aucune donnée supplémentaire</p>
        )}
      </div>
    </div>
  );
};

// ── SVG edges ─────────────────────────────────────────────────────────────────

interface PositionedNode extends GenealogyNode {
  x: number;
  y: number;
}

const computePositions = (nodes: GenealogyNode[]): PositionedNode[] => {
  const colRows: Record<number, number> = {};
  return nodes.map((n) => {
    const col = n.column;
    const row = colRows[col] ?? 0;
    colRows[col] = row + 1;
    return {
      ...n,
      x: PAD + col * (NODE_W + COL_GAP),
      y: PAD + row * (NODE_H + ROW_GAP),
    };
  });
};

const canvasSize = (positioned: PositionedNode[]) => {
  if (positioned.length === 0) return { w: 600, h: 300 };
  const maxX = Math.max(...positioned.map((n) => n.x + NODE_W)) + PAD;
  const maxY = Math.max(...positioned.map((n) => n.y + NODE_H)) + PAD;
  return { w: maxX, h: maxY };
};

interface SvgEdgesProps {
  positioned: PositionedNode[];
  edges: GenealogyEdge[];
  activeNodeId: string | null;
}

const SvgEdges = ({ positioned, edges, activeNodeId }: SvgEdgesProps) => {
  const posMap = new Map(positioned.map((n) => [n.id, n]));
  const { w, h } = canvasSize(positioned);

  return (
    <svg
      width={w}
      height={h}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
        <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
        </marker>
        <marker id="arrowhead-shipment" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const from = posMap.get(edge.from);
        const to = posMap.get(edge.to);
        if (!from || !to) return null;

        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const cx = (x1 + x2) / 2;

        const isActive = activeNodeId === edge.from || activeNodeId === edge.to;
        const isShipment = edge.edgeType === 'shipment';

        const stroke = isShipment ? '#10b981' : isActive ? '#3b82f6' : '#cbd5e1';
        const strokeW = isActive ? 2.5 : 1.5;
        const dash = edge.edgeType === 'output' ? '5,3' : undefined;
        const marker = isShipment ? 'url(#arrowhead-shipment)' : isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)';

        return (
          <path
            key={edge.id}
            d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeW}
            strokeDasharray={dash}
            markerEnd={marker}
            opacity={activeNodeId && !isActive ? 0.25 : 1}
            className="transition-all duration-300"
          />
        );
      })}
    </svg>
  );
};

// ── Single node card ───────────────────────────────────────────────────────────

interface NodeCardProps {
  node: PositionedNode;
  isActive: boolean;
  onClick: () => void;
}

const NodeCard = ({ node, isActive, onClick }: NodeCardProps) => {
  const s = NODE_STYLE[node.type];
  const Icon = s.icon;

  return (
    <div
      className={cn(
        'absolute select-none cursor-pointer rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md',
        s.bg, s.border,
        isActive && 'ring-2 ring-blue-400 ring-offset-1 shadow-lg scale-105',
      )}
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1">
        <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0', s.bg)}>
          <Icon className={cn('h-3.5 w-3.5', s.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-bold truncate leading-tight', s.text)}>{node.label}</p>
          {node.sublabel && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{node.sublabel}</p>
          )}
        </div>
      </div>
      <div className="px-2.5 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{s.label}</span>
        {node.status && (
          <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full font-semibold', STATUS_BADGE[node.status] ?? 'bg-gray-100 text-gray-500')}>
            {node.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Column headers ─────────────────────────────────────────────────────────────

const COL_LABELS: Record<number, string> = {
  0: 'Lot reçu',
  1: 'QC entrant',
  2: 'Traitement',
  3: 'Triage',
  4: 'Sous-lots',
  5: 'Production',
  6: 'Lots PF / Stock',
  7: 'Conditionnement',
  8: 'Palettes',
  9: 'Expédition',
};

const ColumnHeaders = ({ positioned }: { positioned: PositionedNode[] }) => {
  const cols = [...new Set(positioned.map((n) => n.column))].sort((a, b) => a - b);
  return (
    <>
      {cols.map((col) => {
        const nodesInCol = positioned.filter((n) => n.column === col);
        const x = nodesInCol[0]?.x ?? PAD + col * (NODE_W + COL_GAP);
        return (
          <div
            key={col}
            className="absolute text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap"
            style={{ left: x, top: 8, width: NODE_W, textAlign: 'center' }}
          >
            {COL_LABELS[col] ?? `Col ${col}`}
          </div>
        );
      })}
    </>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

interface LotGenealogyTreeProps {
  lotNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LotGenealogyTree = ({ lotNumber, open, onOpenChange }: LotGenealogyTreeProps) => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tree, isLoading, isError } = useQuery({
    queryKey: ['lot-genealogy', lotNumber],
    queryFn: () => phase2Api.getLotGenealogy(lotNumber),
    enabled: open && !!lotNumber,
    staleTime: 60_000,
  });

  const positioned = tree ? computePositions(tree.nodes) : [];
  const { w, h } = canvasSize(positioned);
  const activeNode = positioned.find((n) => n.id === activeNodeId) ?? null;

  const resetView = useCallback(() => { setZoom(1); setActiveNodeId(null); }, []);

  // Auto-fit zoom when tree loads
  useEffect(() => {
    if (!tree || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth - (activeNode ? 280 : 0);
    const containerH = containerRef.current.clientHeight - 60;
    const fitZoom = Math.min(containerW / w, containerH / h, 1.2);
    setZoom(Math.max(fitZoom, 0.4));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree?.nodes.length, open]);

  const stats = tree?.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base font-bold">
                Arbre généalogique — <span className="font-mono text-primary">{lotNumber}</span>
              </DialogTitle>
              {stats && (
                <div className="flex items-center gap-2 flex-wrap">
                  {stats.stage_count > 0 && (
                    <Badge variant="secondary" className="text-xs">{stats.stage_count} étapes</Badge>
                  )}
                  {stats.total_kg_in != null && (
                    <Badge variant="outline" className="text-xs">{fmtN(stats.total_kg_in)} kg entrants</Badge>
                  )}
                  {stats.palette_count > 0 && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50">
                      {stats.palette_count} palette{stats.palette_count > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {stats.shipment_count > 0 && (
                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">
                      {stats.shipment_count} expédition{stats.shipment_count > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setZoom((z) => Math.min(z + 0.15, 2))} title="Zoom +">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))} title="Zoom -">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={resetView} title="Réinitialiser">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Canvas + detail panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Tree canvas */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-50/60 relative"
            style={{ backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            onClick={() => setActiveNodeId(null)}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Construction de l'arbre généalogique…</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2 text-muted-foreground">
                  <XCircle className="h-8 w-8 mx-auto text-red-300" />
                  <p className="text-sm">Impossible de charger la généalogie de ce lot.</p>
                </div>
              </div>
            )}

            {tree && positioned.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Aucune donnée de traçabilité pour ce lot.</p>
              </div>
            )}

            {tree && positioned.length > 0 && (
              <div
                className="relative origin-top-left transition-transform duration-300"
                style={{
                  width: w,
                  height: h + 30,
                  transform: `scale(${zoom})`,
                  marginTop: 32,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Column headers */}
                <div className="absolute" style={{ top: -28, left: 0, width: '100%' }}>
                  <ColumnHeaders positioned={positioned} />
                </div>

                {/* SVG edges */}
                <SvgEdges positioned={positioned} edges={tree.edges} activeNodeId={activeNodeId} />

                {/* Node cards */}
                {positioned.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    isActive={activeNodeId === node.id}
                    onClick={() => setActiveNodeId(activeNodeId === node.id ? null : node.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {activeNode && (
            <div className="w-[260px] shrink-0 border-l bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Détails</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setActiveNodeId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <NodeDetail node={activeNode} />
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="px-5 py-2.5 border-t bg-slate-50/80 shrink-0 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Légende</span>
          {(Object.entries(NODE_STYLE) as [GenealogyNodeType, NodeStyle][])
            .filter(([type]) => positioned.some((n) => n.type === type))
            .map(([type, s]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          <div className="flex items-center gap-1.5 ml-2">
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)" /></svg>
            <span className="text-[11px] text-muted-foreground">Flux</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
            <span className="text-[11px] text-muted-foreground">Sortie</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
