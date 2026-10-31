import { Children, cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/types/mes';

export const Field = ({ label, required, hint, children, className }: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) => {
  const id = useId();
  const [control, ...rest] = Children.toArray(children);
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {isValidElement(control) ? cloneElement(control as ReactElement<{ id?: string }>, { id }) : control}
      {rest}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

/** Stored values predate accents and stay as they are; employees read proper French. */
const FRENCH_LABELS: Record<string, string> = {
  Bache: 'Bâché',
  'Non bache': 'Non bâché',
  Refrigere: 'Réfrigéré',
  'Semi-mecanique': 'Semi-mécanique',
  Mecanique: 'Mécanique',
  Melange: 'Mélange',
  'En regimes': 'En régimes',
};

export const frenchLabel = (value: string) => FRENCH_LABELS[value] ?? value;

/** One tap instead of a dropdown, for short closed lists. */
export const ChoiceChips = ({ label, value, options, onChange, required }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  required?: boolean;
}) => (
  <Field label={label} required={required}>
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
          )}
        >
          {frenchLabel(option.label)}
        </button>
      ))}
    </div>
  </Field>
);

export const SupplierPicker = ({ suppliers, value, label, onSelect }: {
  suppliers: Supplier[];
  value: string;
  label: string;
  onSelect: (supplier: Supplier) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Fournisseur"
          className="h-12 w-full justify-between text-base font-normal"
        >
          <span className="truncate">{label || 'Rechercher un fournisseur…'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nom ou code du fournisseur" />
          <CommandList>
            <CommandEmpty>Aucun fournisseur actif ne correspond.</CommandEmpty>
            <CommandGroup>
              {suppliers.map((supplier) => (
                <CommandItem
                  key={supplier.id}
                  value={`${supplier.code} ${supplier.name}`}
                  className="min-h-11"
                  onSelect={() => {
                    onSelect(supplier);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === supplier.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-mono text-xs text-muted-foreground">{supplier.code}</span>
                  <span className="ml-2 truncate">{supplier.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
