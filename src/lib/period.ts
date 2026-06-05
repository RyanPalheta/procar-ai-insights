import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Modelo de período padronizado para TODO o dashboard.
 * Atalhos: Hoje | Ontem | 7 | 30 | 90 | Todos | Personalizado (range).
 * "Hoje"/"Ontem" são dia-calendário exatos (não "últimas 24h"), o que o
 * processo diário exige. Tudo é resolvido para um intervalo from/to preciso
 * via resolvePeriod(), usado tanto em filtros client-side quanto nas RPCs.
 */
export type PeriodPreset = "today" | "yesterday" | "7" | "30" | "90" | "all" | "custom";

export interface PeriodValue {
  preset: PeriodPreset;
  /** apenas quando preset === "custom" */
  from?: Date;
  to?: Date;
}

export interface ResolvedPeriod {
  /** limite inferior inclusivo; null = sem limite (todo o período) */
  from: Date | null;
  /** limite superior inclusivo (fim do dia); null = agora / sem limite */
  to: Date | null;
  /** ISO para queries Supabase (.gte/.lte) e params de RPC */
  fromIso: string | null;
  toIso: string | null;
  /** contagem de dias quando o preset mapeia limpo (7/30/90); null caso contrário */
  periodDays: number | null;
  label: string;
}

export const DEFAULT_PERIOD: PeriodValue = { preset: "7" };

function customLabel(from: Date | null, to: Date | null): string {
  if (!from) return "Personalizado";
  const f = format(from, "dd/MM/yyyy", { locale: ptBR });
  const t = to ? format(to, "dd/MM/yyyy", { locale: ptBR }) : "…";
  return `${f} – ${t}`;
}

/** Resolve um PeriodValue para um intervalo from/to preciso (dia-calendário). */
export function resolvePeriod(value: PeriodValue, now: Date = new Date()): ResolvedPeriod {
  const wrap = (
    from: Date | null,
    to: Date | null,
    periodDays: number | null,
    label: string,
  ): ResolvedPeriod => ({
    from,
    to,
    fromIso: from ? from.toISOString() : null,
    toIso: to ? to.toISOString() : null,
    periodDays,
    label,
  });

  switch (value.preset) {
    case "today":
      return wrap(startOfDay(now), endOfDay(now), null, "Hoje");
    case "yesterday": {
      const y = subDays(now, 1);
      return wrap(startOfDay(y), endOfDay(y), null, "Ontem");
    }
    case "7":
      return wrap(startOfDay(subDays(now, 6)), endOfDay(now), 7, "Últimos 7 dias");
    case "30":
      return wrap(startOfDay(subDays(now, 29)), endOfDay(now), 30, "Últimos 30 dias");
    case "90":
      return wrap(startOfDay(subDays(now, 89)), endOfDay(now), 90, "Últimos 90 dias");
    case "all":
      return wrap(null, null, null, "Todo o período");
    case "custom": {
      const from = value.from ? startOfDay(value.from) : null;
      const to = value.to ? endOfDay(value.to) : from ? endOfDay(value.from!) : null;
      return wrap(from, to, null, customLabel(from, to));
    }
  }
}

/**
 * Janela imediatamente anterior, de mesma duração — para cálculo de tendência
 * (variação vs. período anterior) em filtros client-side. Retorna null quando
 * o período não tem limites (Todos) ou está incompleto.
 */
export function previousResolved(r: ResolvedPeriod): { from: Date; to: Date } | null {
  if (!r.from || !r.to) return null;
  const span = r.to.getTime() - r.from.getTime();
  const prevTo = new Date(r.from.getTime() - 1);
  const prevFrom = new Date(r.from.getTime() - span - 1);
  return { from: prevFrom, to: prevTo };
}

/** Conveniência: true se um timestamp cai dentro do intervalo resolvido. */
export function isWithin(ts: string | number | Date, r: ResolvedPeriod): boolean {
  const t = new Date(ts).getTime();
  if (r.from && t < r.from.getTime()) return false;
  if (r.to && t > r.to.getTime()) return false;
  return true;
}
