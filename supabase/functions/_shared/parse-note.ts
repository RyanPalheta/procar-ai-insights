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
  /**
   * Itens de UPSELL declarados no note no formato "(UPSELL: LED - JP)" ou
   * com vários itens separados por vírgula "(UPSELL: LED, SOUND SYSTEM - JP)".
   * Cada item conta 1. Vazio quando não há marcador de upsell. (BLOCO upsell)
   */
  upsell: string[];
  /**
   * Parceiros de financiamento citados no note. Tokens reconhecidos:
   * SNAP, ACIMA, AMERICAN FIRST. Podem vir separados por vírgula no mesmo
   * note e cada um conta 1 unidade. Vazio quando não há. (BLOCO N — financiamento)
   */
  financing: string[];
  /**
   * Agendamento por INDICAÇÃO — note menciona "INDICACAO"/"indicação"/"indicado"
   * em QUALQUER lugar (não depende de walk-in). Os formatos reais variam:
   * "WALK-IN:INDICACAO DO AMIGO", "Indicação de amigo - Claudson",
   * "INDICACAO: (781)...". (BLOCO K) */
  isReferral: boolean;
  /** Note contém "absoluto" → entra no card Absoluto. (BLOCO G) */
  isAbsoluto: boolean;
  /**
   * Note contém exatamente "APONTAMENTO MARCADO VIA TELEFONE ATIVO" → agendamento
   * realizado via follow-up de ligação ativa. (BLOCO J) */
  phoneActiveBooking: boolean;
}

// Cobre: "walk in", "walk-in", "walkin", "walk - in", "walking", o plural
// "walk-ins/walkins", "walked in"/"walks in" e o rótulo ABREVIADO "WALK:"
// (campo do note escrito sem o "-IN", ex.: "... COPIA DE CHAVE WALK: CLIENTE ANTIGO").
// "walk" só dispara quando é palavra inteira (\b) seguida de in/ins/":" — não pega
// sidewalk/boardwalk/walkway/walk-up.
const WALK_RE = /\bwalk(?:ed|s)?\s*-?\s*ins?\b|\bwalkins?\b|\bwalking\b|\bwalk\s*-?\s*:/i;

// Vendedores conhecidos (ajustável conforme o time cresce).
// NÃO incluir nomes de PRODUTOS aqui: "Maestro" é um item vendido (aparece no
// trecho <PRODUTO> do note), não um vendedor — removido em 2026-06-23.
const SELLERS = ["henrique", "jp", "gabriel", "ricardo", "matheus", "fabricio", "fabrício"];

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

// --- BLOCO upsell: "(UPSELL: LED - JP)" / "(UPSELL: LED, SOUND SYSTEM - JP)" ---
// Captura o miolo entre "UPSELL:" e o ")"; remove o sufixo " - <iniciais do
// vendedor>" e separa os itens por vírgula. Cada item = 1 unidade.
const UPSELL_RE = /\(\s*upsell\s*:\s*([^)]+?)\s*\)/gi;
function parseUpsell(note: string): string[] {
  const items: string[] = [];
  for (const m of note.matchAll(UPSELL_RE)) {
    // tira o " - JP" final (iniciais do vendedor), preservando itens com vírgula
    const inner = m[1].replace(/\s*-\s*[^,\-]+$/, "");
    for (const raw of inner.split(",")) {
      const item = raw.trim().toUpperCase();
      if (item) items.push(item);
    }
  }
  return items;
}

// --- BLOCO N (financiamento): SNAP, ACIMA, AMERICAN FIRST (1 unidade cada) ---
const FINANCING_TOKENS: { label: string; re: RegExp }[] = [
  { label: "SNAP", re: /\bsnap\b/i },
  { label: "ACIMA", re: /\bacima\b/i },
  { label: "AMERICAN FIRST", re: /\bamerican\s+first\b/i },
];
function parseFinancing(note: string): string[] {
  return FINANCING_TOKENS.filter((t) => t.re.test(note)).map((t) => t.label);
}

// BLOCO J: a nota deve conter exatamente "APONTAMENTO MARCADO VIA TELEFONE ATIVO"
// (tolerante a espaços extras e caixa; o note já vem com espaços colapsados).
const PHONE_ACTIVE_RE = /apontamento\s+marcado\s+via\s+telefone\s+ativo/i;

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
  if (!note) {
    return {
      walkIn: false, source: null, seller: null, channel: null,
      upsell: [], financing: [], isReferral: false, isAbsoluto: false, phoneActiveBooking: false,
    };
  }

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
  const upsell = parseUpsell(note);
  const financing = parseFinancing(note);
  const isReferral = /\bindica/i.test(note); // indicacao / indicação / indicado
  const isAbsoluto = /\babsoluto\b/i.test(note);
  const phoneActiveBooking = PHONE_ACTIVE_RE.test(note);

  return { walkIn, source, seller, channel, upsell, financing, isReferral, isAbsoluto, phoneActiveBooking };
}
