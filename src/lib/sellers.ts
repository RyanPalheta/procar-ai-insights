// Normalização de vendedor no FRONT — espelho da função SQL
// public.canonical_seller e de supabase/functions/_shared/canonical-seller.ts.
// MANTER OS TRÊS EM SINCRONIA ao adicionar/renomear vendedores.
//
// Por que existe: várias telas (filtro de vendedor em Leads/TV, dropdown de
// Metas, detalhe do lead) leem lead_db.sales_person_id CRU, que tem a conta
// genérica "Pro Car Sound & Security" e variações de caixa/sufixo ("Doug - Pro
// Car"). As RPCs de vendedor já agrupam por canonical_seller; estas telas
// passam a usar o mesmo mapa para bater com a aba Vendedores.
//
// Regra Pro Car (2026-06-12): o usuário genérico "Pro Car Sound & Security" é
// operado pelo próprio Ricardo → mapeia para 'Ricardo'.

export function canonicalSeller(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const l = t.toLowerCase();
  if (/registrad|no notes/.test(l)) return null;
  if (/sound.*security/.test(l)) return "Ricardo";
  if (l.includes("henrique")) return "Henrique";
  if (l.includes("ricar")) return "Ricardo";
  if (l.includes("matheus")) return "Matheus";
  if (l.includes("gabriel")) return "Gabriel";
  if (l.includes("vitor") || l.includes("vítor")) return "Vitor";
  if (l.includes("joao pedro") || l.includes("joão pedro")) return "JP";
  if (["jp", "joao", "joão"].includes(l)) return "JP";
  if (l.includes("doug")) return "Doug";
  if (l.includes("maick")) return "Maick";
  if (l.includes("maestro")) return null; // "Maestro" é um PRODUTO vendido, não um vendedor (Pro Car, 2026-06-23)
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Lista canônica única (ordenada) a partir de valores crus de sales_person_id.
export function uniqueCanonicalSellers(raws: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const r of raws) {
    const c = canonicalSeller(r);
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Filtro PostgREST `.or(...)` que casa TODOS os sales_person_id crus que
// canonicalizam para `canonical`. Usado onde a query precisa rodar no servidor
// (SellerDetailView) e o `.eq` no nome canônico não pegaria a conta genérica
// nem os sufixos. Inverso de canonicalSeller — MANTER EM SINCRONIA.
export function sellerOrFilter(canonical: string): string {
  const map: Record<string, string[]> = {
    Ricardo: ["sales_person_id.ilike.%ricar%", "sales_person_id.ilike.%sound%security%"],
    Henrique: ["sales_person_id.ilike.%henrique%"],
    Matheus: ["sales_person_id.ilike.%matheus%"],
    Gabriel: ["sales_person_id.ilike.%gabriel%"],
    Vitor: ["sales_person_id.ilike.%vitor%", "sales_person_id.ilike.%vítor%"],
    JP: [
      "sales_person_id.ilike.%joao pedro%",
      "sales_person_id.ilike.%joão pedro%",
      "sales_person_id.eq.JP",
      "sales_person_id.eq.jp",
      "sales_person_id.eq.joao",
      "sales_person_id.eq.joão",
    ],
    Doug: ["sales_person_id.ilike.%doug%"],
    Maick: ["sales_person_id.ilike.%maick%"],
    // "Maestro" removido: é um produto, não um vendedor (canonicalSeller retorna null).
  };
  return (map[canonical] ?? [`sales_person_id.eq.${canonical}`]).join(",");
}
