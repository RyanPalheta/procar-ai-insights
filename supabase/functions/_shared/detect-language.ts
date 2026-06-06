// detect-language — detector DETERMINÍSTICO (código puro, sem IA) de PT/EN/ES a
// partir das mensagens do CLIENTE. Saída no formato que o dashboard já usa
// (PT-BR / EN-USA / ES-ES), p/ casar com o LeadsLanguageChart e os dados legados.
//
// Por quê código puro: o idioma da Pro Car (português, inglês, espanhol) é bem
// separável por palavras-marcadoras + acentos; evita custo/latência de reanálise
// por IA. Mesma filosofia do parseNote. Conservador: se não houver sinal, NULL.

export type LeadLang = "PT-BR" | "EN-USA" | "ES-ES";

// Marcadores discriminativos (evita tokens ambíguos PT/ES como "no", "para", "carro").
const PT = [
  "não", "nao", "você", "voce", "vc", "obrigado", "obrigada", "bom dia", "boa tarde",
  "boa noite", "tudo bem", "orçamento", "orcamento", "vou", "pra", "né", "valeu",
  "reais", "gostaria", "quanto custa", "quanto fica", "tô", "estou", "amanhã", "então",
];
const ES = [
  "hola", "gracias", "buenos", "buenas", "días", "dias", "cuánto", "cuanto", "cuesta",
  "mañana", "sí", "usted", "qué", "cómo", "necesito", "quiero", "tiene", "tienes",
  "precio", "por favor", "vale", "está bien", "buenas tardes", "disculpe", "señor",
];
const EN = [
  "the", "you", "your", "hello", "hi ", "hey", "thanks", "thank you", "how much",
  "do you", "can you", "i need", "i want", "i'm", "please", "today", "tomorrow",
  "is ", "are ", "for ", "with", "good morning", "what", "when", "appointment",
];

function hits(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (text.includes(w)) n++;
  return n;
}

/** Detecta PT-BR / EN-USA / ES-ES das mensagens do cliente; NULL se sem sinal. */
export function detectLanguage(messages: (string | null | undefined)[]): LeadLang | null {
  const raw = messages.filter(Boolean).join(" ").toLowerCase();
  if (!raw.trim()) return null;
  // normaliza pontuação em espaço, preservando letras acentuadas e ñ/¿/¡
  const t = " " + raw.replace(/[^0-9a-zà-ÿñ¿¡'\s]/g, " ").replace(/\s+/g, " ") + " ";

  let pt = hits(t, PT);
  let es = hits(t, ES);
  let en = hits(t, EN);

  // sinais de caractere (fortes)
  if (/[ãõ]/.test(t)) pt += 2;
  if (/ç/.test(t)) pt += 1;
  if (/ñ/.test(t) || /[¿¡]/.test(t)) es += 2;

  const max = Math.max(pt, es, en);
  if (max === 0) return null;
  // desempate PT/ES por acento já embutido nos pesos acima
  if (pt === max && pt >= es && pt >= en) return "PT-BR";
  if (es === max && es >= en) return "ES-ES";
  return "EN-USA";
}
