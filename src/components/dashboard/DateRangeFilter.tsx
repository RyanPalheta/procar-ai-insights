import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
}

export function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange }: DateRangeFilterProps) {
  const applyPreset = (days: number) => {
    const now = new Date();
    onDateFrom(startOfDay(subDays(now, days)));
    onDateTo(endOfDay(now));
  };

  const onDateFrom = onDateFromChange;
  const onDateTo = onDateToChange;

  return (
    <div className="flex items-center gap-2">
      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[150px] justify-start text-left font-normal bg-background",
              !dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="start">
          <div className="flex gap-1 p-2 border-b">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => applyPreset(0)}>Hoje</Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => applyPreset(7)}>7d</Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => applyPreset(30)}>30d</Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => applyPreset(90)}>90d</Button>
          </div>
          <Calendar
            mode="single"
            selected={dateFrom}
            onSelect={onDateFromChange}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground text-sm">até</span>

      {/* Date To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[150px] justify-start text-left font-normal bg-background",
              !dateTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={onDateToChange}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
