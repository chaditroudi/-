import { useState } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const presets = [
  { label: "Aujourd'hui", getValue: () => {
    const today = new Date();
    return { from: today, to: today };
  }},
  { label: "Hier", getValue: () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: yesterday, to: yesterday };
  }},
  { label: "7 jours", getValue: () => {
    const today = new Date();
    const last7 = new Date();
    last7.setDate(today.getDate() - 7);
    return { from: last7, to: today };
  }},
  { label: "30 jours", getValue: () => {
    const today = new Date();
    const last30 = new Date();
    last30.setDate(today.getDate() - 30);
    return { from: last30, to: today };
  }},
];

export const DateRangeFilter = ({ dateRange, onDateRangeChange }: DateRangeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange(undefined);
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    onDateRangeChange(preset.getValue());
    setIsOpen(false);
  };

  const formatDateRange = () => {
    if (!dateRange?.from) return null;
    
    if (dateRange.to && dateRange.from.toDateString() !== dateRange.to.toDateString()) {
      return `${format(dateRange.from, 'dd/MM', { locale: fr })} → ${format(dateRange.to, 'dd/MM', { locale: fr })}`;
    }
    
    return format(dateRange.from, 'dd MMM', { locale: fr });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 font-normal border-dashed transition-all",
            dateRange?.from && "border-solid border-primary bg-primary/5 text-primary"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {dateRange?.from ? (
            <>
              <span>{formatDateRange()}</span>
              <X 
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100" 
                onClick={handleClear}
              />
            </>
          ) : (
            <span>Date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" align="end" sideOffset={8}>
        {/* Quick presets */}
        <div className="flex gap-1 p-2 border-b bg-muted/30">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="h-9 text-xs rounded-full px-3 hover:bg-primary/10 hover:text-primary"
              onClick={() => handlePresetClick(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        
        {/* Calendar */}
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={(range) => {
            onDateRangeChange(range);
            if (range?.from && range?.to) {
              setIsOpen(false);
            }
          }}
          numberOfMonths={1}
          locale={fr}
          className="p-3 pointer-events-auto"
          disabled={(date) => date > new Date()}
        />
        
        {/* Footer */}
        {dateRange?.from && (
          <div className="flex items-center justify-between p-2 border-t bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {dateRange.to 
                ? `${format(dateRange.from, 'dd MMM', { locale: fr })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: fr })}`
                : `À partir du ${format(dateRange.from, 'dd MMM', { locale: fr })}`
              }
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                onDateRangeChange(undefined);
                setIsOpen(false);
              }}
            >
              Effacer
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

// Helper function to filter receptions by date range
export const filterByDateRange = <T extends { created_at: string }>(
  items: T[],
  dateRange: DateRange | undefined
): T[] => {
  if (!dateRange?.from) return items;
  
  const start = startOfDay(dateRange.from);
  const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
  
  return items.filter(item => {
    const itemDate = new Date(item.created_at);
    return isWithinInterval(itemDate, { start, end });
  });
};
