// Verdade única sobre "ganho" e normalização de sales_status. O sales_status é
// texto livre do funil da Kommo, com variações de caixa/sinônimos — por isso o RPC
// get_sellers_kpis conta ganho via LOWER(sales_status) LIKE '%ganha%'/'%won%'/
// '%agendamento confirmado%'. Reusar isto mantém os GRÁFICOS coerentes com os CARDS
// (que vêm do RPC), evitando que "os números mudem ao abrir o detalhe".

export function isWonStatus(status?: string | null): boolean {
  const v = (status ?? "").toLowerCase();
  return v.includes("ganha") || v.includes("won") || v.includes("agendamento confirmado");
}

const STATUS_CANON: { test: (s: string) => boolean; label: string }[] = [
  { test: (s) => isWonStatus(s), label: "Ganha / Agendada" },
  { test: (s) => s.includes("perdida") || s.includes("perdeu") || s.includes("lost"), label: "Perdida" },
  { test: (s) => s.includes("descartad"), label: "Descartada" },
  { test: (s) => s.includes("negocia"), label: "Em negociação" },
  { test: (s) => s.includes("novo") || s.includes("contato"), label: "Novo / Em contato" },
];

/**
 * Colapsa variações do MESMO status numa etapa canônica, para as proporções do
 * gráfico ficarem reais (sem fragmentar "Ganha"/"ganha"/"Lead Ganho" em barras
 * distintas). A fatia "Ganha / Agendada" passa a bater com won_leads do card.
 */
export function canonSalesStatus(raw?: string | null): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "Sem status";
  const hit = STATUS_CANON.find((c) => c.test(s));
  if (hit) return hit.label;
  // fallback: Title Case do bruto, sem fragmentar por caixa/espaços extras
  return (raw ?? "").trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
