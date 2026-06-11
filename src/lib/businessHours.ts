// Horário de atendimento da loja (Malden, MA): 09h–20h America/New_York.
// Mesma regra da RPC public.business_minutes_between (migration 20260611240000).
const SHOP_TZ = "America/New_York";
const OPEN_HOUR = 9;
const CLOSE_HOUR = 20;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const wallFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Instante UTC -> milissegundos de "hora de parede" no fuso da loja. */
function toWallMs(instant: Date): number {
  const p: Record<string, number> = {};
  for (const { type, value } of wallFmt.formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
}

/**
 * Minutos decorridos entre `from` e `to` contando SÓ o horário de atendimento
 * (09h–20h, fuso da loja). Lead da madrugada respondido às 9h30 = 30 min;
 * resposta com ambos os lados fora do expediente = 0 min.
 */
export function businessMinutesBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const wallFrom = toWallMs(from);
  const wallTo = toWallMs(to);
  let totalMs = 0;
  for (let day = Math.floor(wallFrom / DAY_MS) * DAY_MS; day <= wallTo; day += DAY_MS) {
    const open = day + OPEN_HOUR * HOUR_MS;
    const close = day + CLOSE_HOUR * HOUR_MS;
    totalMs += Math.max(0, Math.min(wallTo, close) - Math.max(wallFrom, open));
  }
  return totalMs / 60_000;
}
