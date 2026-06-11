// parse-note — parser DETERMINÍSTICO (código puro, sem IA/n8n) do note do
// agendamento ShopMonkey. Extrai walk-in, origem e vendedor.
//
// Baseado nos padrões REAIS minerados das notes (amostra de 4.352 agendamentos):
// estrutura típica "<IDIOMA> - <PRODUTO> - <VENDEDOR> / WALK-IN: <ORIGEM>".
// Formas de escrever walk-in encontradas: walkin (47), walk-in (27),
// walk in (21), walk - in (9), walking (1) → todas cobertas pela regex abaixo.
// Substitui o parseAppointmentNotes (Gemini) da integração.

export interface ParsedNote {
  /** É walk-in? (cliente que veio à loja). */
  walkIn: boolean;
  /** Origem declarada após o marcador walk-in (cliente antigo, indicação, google…). */
  source: string | null;
  /** Vendedor humano citado no note. */
  seller: string | null;
  /**
   * Canal do ATENDIMENTO que gerou o agendamento (2ª auditoria, legenda B —
   * "atendimentos × agendamentos por canal"). Minerado dos marcadores que a
   * própria equipe escreve no note: "... RICARDO KOMMO", "... RICARDO TELEFONE".
   * Valores: kommo | telefone | instagram | facebook | google | presencial | null.
   */
  channel: string | null;
}

// Cobre: "walk in", "walk-in", "walkin", "walk - in", "walking", o plural
// "walk-ins/walkins", "walked in"/"walks in" e o rótulo ABREVIADO "WALK:"
// (campo do note escrito sem o "-IN", ex.: "... COPIA DE CHAVE WALK: CLIENTE ANTIGO").
// "walk" só dispara quando é palavra inteira (\b) seguida de in/ins/":" — não pega
// sidewalk/boardwalk/walkway/walk-up.
const WALK_RE = /\bwalk(?:ed|s)?\s*-?\s*ins?\b|\bwalkins?\b|\bwalking\b|\bwalk\s*-?\s*:/i;

// Vendedores conhecidos (ajustável conforme o time cresce).
const SELLERS = ["henrique", "jp", "gabriel", "ricardo", "matheus", "maestro"];

/** Normaliza a origem para os 20 padrões observados nas notes. */
function normalizeSource(s: string): string | null {
  const t = s.toLowerCase().trim();
  if (!t) return null;
  if (/cliente antigo|antig/.test(t)) return "cliente antigo";
  if (/indica|referr|amigo|primo|m[ãa]e|esposa|marido|conhecid/.test(t)) return "indicação";
  if (/google/.test(t)) return "google";
  if (/insta|\big\b/.test(t)) return "instagram";
  if (/face|\bfb\b/.test(t)) return "facebook";
  if (/site|website|\bweb\b/.test(t)) return "website";
  if (/whats|\bwpp\b|zap/.test(t)) return "whatsapp";
  if (/tiktok/.test(t)) return "tiktok";
  if (/passando|passou|pela rua|vitrine|fachada/.test(t)) return "passagem";
  // fallback: primeiras palavras como origem crua
  const words = t.split(/[\s,;.]+/).filter(Boolean).slice(0, 3).join(" ");
  return words || null;
}

/** Canal do atendimento a partir dos marcadores escritos no note. */
function detectChannel(lower: string, walkIn: boolean): string | null {
  if (/\bkommo\b/.test(lower)) return "kommo";
  if (/\btelefone\b|\bphone\b|liga[çc][ãa]o/.test(lower)) return "telefone";
  if (/\binsta(gram)?\b|\big\b/.test(lower)) return "instagram";
  if (/\bface(book)?\b|\bfb\b/.test(lower)) return "facebook";
  if (/\bgoogle\b/.test(lower)) return "google";
  if (walkIn) return "presencial";
  return null;
}

export function parseNote(raw: string | null | undefined): ParsedNote {
  const note = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!note) return { walkIn: false, source: null, seller: null, channel: null };

  const lower = note.toLowerCase();
  const walkIn = WALK_RE.test(note);

  // Origem: texto logo após o marcador walk-in, até um delimitador (/ . - fim).
  let source: string | null = null;
  if (walkIn) {
    const m =
      lower.match(/walk(?:ed|s)?\s*-?\s*ins?\s*[:\-]?\s*([^/.\n]+)/) ||
      lower.match(/walkins?\s*[:\-]?\s*([^/.\n]+)/) ||
      lower.match(/walking\s*[:\-]?\s*([^/.\n]+)/) ||
      lower.match(/\bwalk\s*-?\s*:\s*([^/.\n]+)/);
    if (m) source = normalizeSource(m[1]);
  }

  const seller = SELLERS.find((s) => new RegExp(`\\b${s}\\b`, "i").test(lower)) ?? null;
  const channel = detectChannel(lower, walkIn);

  return { walkIn, source, seller, channel };
}
