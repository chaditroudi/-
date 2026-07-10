import { useState, useMemo } from 'react';
import { useAvailableLotsForPhase2, AvailableLot } from '@/hooks/useAvailableLotsForPhase2';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, Package, Loader2 } from 'lucide-react';

interface Props {
  value: string | null;                // reception_id
  onChange: (lot: AvailableLot | null) => void;
  placeholder?: string;
  disabled?: boolean;
  // If true, allow picking multiple lots (for fumigation/hydration)
  multi?: false;
}

interface MultiProps {
  value: string[];                    // array of reception_ids
  onChange: (lots: AvailableLot[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multi: true;
  maxItems?: number;
}

export function LotSelector(props: Props | MultiProps) {
  const { data: lots = [], isLoading } = useAvailableLotsForPhase2();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const isMulti = props.multi === true;

  const filtered = useMemo(() => {
    if (!search) return lots.slice(0, 30);
    const q = search.toLowerCase();
    return lots
      .filter(
        (l) =>
          l.reception_number.toLowerCase().includes(q) ||
          (l.variety ?? '').toLowerCase().includes(q) ||
          (l.supplier_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [lots, search]);

  const selectedIds = isMulti ? props.value : props.value ? [props.value] : [];
  const selectedLots = lots.filter((l) => selectedIds.includes(l.id));

  const toggleLot = (lot: AvailableLot) => {
    if (isMulti) {
      const multiProps = props as MultiProps;
      const current = multiProps.value;
      if (current.includes(lot.id)) {
        multiProps.onChange(lots.filter((l) => current.filter((id) => id !== lot.id).includes(l.id)));
      } else {
        const max = multiProps.maxItems ?? 20;
        if (current.length >= max) return;
        multiProps.onChange(lots.filter((l) => [...current, lot.id].includes(l.id)));
      }
    } else {
      const singleProps = props as Props;
      if (singleProps.value === lot.id) {
        singleProps.onChange(null);
        setOpen(false);
      } else {
        singleProps.onChange(lot);
        setOpen(false);
      }
    }
  };

  const displayLabel = () => {
    if (isLoading) return <span className="text-muted-foreground">Chargement…</span>;
    if (selectedLots.length === 0) return <span className="text-muted-foreground">{props.placeholder ?? 'Sélectionner un lot…'}</span>;
    if (selectedLots.length === 1) {
      const l = selectedLots[0];
      return (
        <span className="font-mono text-xs">
          {l.reception_number} {l.variety ? `· ${l.variety}` : ''} {l.quantity_total != null ? `· ${l.quantity_total} ${l.unit ?? 'kg'}` : ''}
        </span>
      );
    }
    return <span className="text-xs">{selectedLots.length} lots sélectionnés</span>;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={props.disabled || isLoading}
          className="w-full justify-between h-9 text-left font-normal"
        >
          <span className="flex-1 min-w-0 truncate">{isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : displayLabel()}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Rechercher par N° lot, variété…"
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              {isLoading ? 'Chargement lots disponibles…' : 'Aucun lot éligible Phase 2 trouvé.'}
            </CommandEmpty>
            <CommandGroup heading={`Lots disponibles (${lots.length})`}>
              {filtered.map((lot) => {
                const isSelected = selectedIds.includes(lot.id);
                return (
                  <CommandItem
                    key={lot.id}
                    value={lot.reception_number}
                    onSelect={() => toggleLot(lot)}
                    className="gap-2"
                  >
                    <Check className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold">{lot.reception_number}</span>
                        {lot.qc_grade && <Badge variant="outline" className="text-[11px] h-4 px-1">Grade {lot.qc_grade}</Badge>}
                        {lot.is_bio && <Badge variant="outline" className="text-[11px] h-4 px-1 text-green-700">BIO</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        {lot.variety && <span>{lot.variety}</span>}
                        {lot.quantity_total != null && <span>{lot.quantity_total.toLocaleString('fr-TN')} {lot.unit ?? 'kg'}</span>}
                        {lot.storage_zone_code && <span>Zone: {lot.storage_zone_code}</span>}
                      </div>
                    </div>
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
