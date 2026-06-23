// canonicalSeller — normaliza o nome do vendedor vindo do note (parseNote, em
// minúsculo) ou do custom field "Vendedor shopmonkey" da Kommo (variações de
// caixa/typo). Sentinela ("Não registrado no notes do agendamento") e vazio -> null.
// Espelha a função SQL public.canonical_seller usada nas RPCs de vendedor — mantenha
// as duas em sincronia ao adicionar/renomear vendedores.

export function canonicalSeller(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const l = t.toLowerCase();
  if (/registrad|no notes/.test(l)) return null;
  if (/sound.*security/.test(l)) return 'Ricardo'; // o usuário genérico "Pro Car Sound & Security" é operado pelo próprio Ricardo (decisão Pro Car 2026-06-12)
  if (l.includes('henrique')) return 'Henrique';
  if (l.includes('ricar')) return 'Ricardo'; // ricardo, ricarod
  if (l.includes('matheus')) return 'Matheus';
  if (l.includes('gabriel')) return 'Gabriel';
  if (l.includes('vitor') || l.includes('vítor')) return 'Vitor';
  if (['jp', 'joao pedro', 'joão pedro', 'joao', 'joão'].includes(l)) return 'JP';
  if (l.includes('doug')) return 'Doug'; // "Doug - Pro Car" etc.
  if (l.includes('maick')) return 'Maick';
  if (l.includes('fabricio') || l.includes('fabrício')) return 'Fabricio';
  if (l.includes('maestro')) return null; // "Maestro" é um PRODUTO vendido, não um vendedor (Pro Car, 2026-06-23)
  return t.charAt(0).toUpperCase() + t.slice(1);
}
