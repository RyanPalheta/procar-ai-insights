import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PeriodValue, PeriodPreset } from "@/lib/period";

/**
 * Seletor de período PADRONIZADO usado em todas as abas do dashboard.
 * Faixa segmentada: [ Hoje | Ontem | 7 dias | 30 dias | 90 dias | Todos ] [ 📅 Personalizado ]
 * "Hoje" é o primeiro botão (à esquerda do "7 dias"), conforme solicitado.
 * Controlado: o pai detém o estado (PeriodValue) e resolve o intervalo com resolvePeriod().
 */

type PresetButton = { preset: Exclude<PeriodPreset, "custom">; label: string };

const ALL_PRESETS: PresetButton[] = [
  { preset: "today", label: "Hoje" },
  { preset: "yesterday", label: "Ontem" },
  { preset: "7", label: "7 dias" },
  { preset: "30", label: "30 dias" },
  { preset: "90", label: "90 dias" },
  { preset: "all", label: "Todos" },
];

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  className?: string;
  /** Quais presets exibir (na ordem). Default: todos. Ex.: abas de anúncios omitem "all". */
  presets?: Array<Exclude<PeriodPreset, "custom">>;
  /** Esconde o botão "Personalizado" (range). Default: false. */
  hideCustom?: boolean;
}

export function PeriodFilter({ value, onChange, className, presets, hideCustom }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);

  const shown = presets
    ? ALL_PRESETS.filter((b) => presets.includes(b.preset))
    : ALL_PRESETS;

  const customActive = value.preset === "custom";
  const customLabel =
    customActive && value.from
      ? `${format(value.from, "dd/MM/yy", { locale: ptBR })} – ${value.to ? format(value.to, "dd/MM/yy", { locale: ptBR }) : "…"}`
      : "Personalizado";

  const selectedRange: DateRange | undefined =
    customActive && value.from ? { from: value.from, to: value.to ?? value.from } : undefined;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;
    onChange({ preset: "custom", from: range.from, to: range.to ?? range.from });
    if (range.from && range.to) setOpen(false);
  };

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1", className)}>
      {shown.map((b) => {
        const active = value.preset === b.preset;
        return (
          <Button
            key={b.preset}
            size="sm"
            variant={active ? "default" : "ghost"}
            onClick={() => onChange({ preset: b.preset })}
            className={cn("h-7 rounded-md px-2.5 text-xs", active && "shadow-sm")}
          >
            {b.label}
          </Button>
        );
      })}

      {!hideCustom && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={customActive ? "default" : "ghost"}
              className={cn("h-7 gap-1 rounded-md px-2.5 text-xs", customActive && "shadow-sm")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {customLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="end">
            <Calendar
              mode="range"
              locale={ptBR}
              numberOfMonths={2}
              selected={selectedRange}
              defaultMonth={value.from}
              onSelect={handleRangeSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
