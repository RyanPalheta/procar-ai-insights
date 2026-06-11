import { subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Modelo de período padronizado para TODO o dashboard.
 * Atalhos: Hoje | Ontem | 7 | 30 | 90 | Todos | Personalizado (range).
 * "Hoje"/"Ontem" são dia-calendário exatos (não "últimas 24h"), o que o
 * processo diário exige. Tudo é resolvido para um intervalo from/to preciso
 * via resolvePeriod(), usado tanto em filtros client-side quanto nas RPCs.
 *
 * FUSO (2ª auditoria, 11/06/2026): o dia-calendário é ancorado no FUSO DA
 * LOJA/KOMMO (America/New_York), não no fuso do navegador de quem vê. Antes,
 * um auditor no Brasil via o "Hoje" virar 1-2h antes do "Hoje" da Kommo e
 * concluía que o painel divergia (ex.: Kommo 50 leads × painel ~5 na virada).
 */
export const SHOP_TZ = "America/New_York";

/** Offset (ms) do fuso `timeZone` em relação ao UTC no instante `date`. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** Meia-noite do dia de `date` no fuso da loja, como instante UTC. */
function startOfDay(date: Date): Date {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [y, m, d] = dtf.format(date).split("-").map(Number);
  let guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // corrige pelo offset do fuso naquele instante (2 iterações cobrem DST)
  for (let i = 0; i < 2; i++) {
    guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMs(guess, SHOP_TZ));
  }
  return guess;
}

/** Último ms do dia de `date` no fuso da loja (via meia-noite do dia seguinte). */
function endOfDay(date: Date): Date {
  const mid = new Date(startOfDay(date).getTime() + 30 * 3600 * 1000); // cai no dia seguinte
  return new Date(startOfDay(mid).getTime() - 1);
}

// Para telas que montam o dia manualmente (ex.: aba Hoje) usarem o MESMO fuso.
export { startOfDay as startOfDayShop, endOfDay as endOfDayShop };
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
