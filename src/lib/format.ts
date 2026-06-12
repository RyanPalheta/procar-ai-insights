/**
 * Formatação numérica padrão do dashboard (pt-BR).
 * Regras do design system: milhares abreviados com "k",
 * percentuais com 1 casa decimal e vírgula.
 */

/** 184200 → "184k" · 9240 → "9,2k" · 318 → "318" */
export function formatCompact(value: number): string {
  if (value >= 10000) return `${Math.round(value / 1000).toLocaleString("pt-BR")}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return value.toLocaleString("pt-BR");
}

/** 5.04 → "5,0%" (decimals configurável) */
export function formatPercentBR(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}
