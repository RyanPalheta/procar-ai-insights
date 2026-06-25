import * as XLSX from "xlsx";

// Utilitários de EXPORTAÇÃO (checklist P #61: Excel / CSV). Sem dependência nova —
// CSV é nativo (Blob) e o XLSX usa a lib `xlsx` já instalada no projeto.

type Row = Record<string, unknown>;

function toCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // aspas quando há separador/aspas/quebra de linha; aspas internas dobradas
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Exporta linhas (array de objetos) como CSV. BOM UTF-8 para o Excel ler acentos. */
export function exportToCsv(rows: Row[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(toCsvValue).join(",")];
  for (const r of rows) lines.push(headers.map((h) => toCsvValue(r[h])).join(","));
  const BOM = String.fromCharCode(0xfeff); // Excel reconhece UTF-8 (acentos) pelo BOM
  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Exporta linhas como planilha .xlsx usando a lib `xlsx` já instalada. */
export function exportToXlsx(rows: Row[], filename: string, sheetName = "Dados") {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

const escHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

/**
 * Exporta como PDF SEM dependência nova: abre uma aba com a tabela estilizada
 * (cabeçalho vermelho ProCar) e dispara o diálogo de impressão — o usuário salva
 * como PDF. Robusto e offline. (checklist P #61 — Excel / CSV / PDF)
 */
export function exportToPdf(rows: Row[], title: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const thead = `<tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escHtml(r[h])}</td>`).join("")}</tr>`)
    .join("");
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>` +
    `<style>body{font-family:Arial,Helvetica,sans-serif;padding:16px;color:#111}` +
    `h1{font-size:16px;margin:0 0 12px}` +
    `table{border-collapse:collapse;width:100%;font-size:11px}` +
    `th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}` +
    `th{background:#E4002B;color:#fff}tr:nth-child(even){background:#f7f7f7}</style></head>` +
    `<body><h1>${escHtml(title)}</h1><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>` +
    `<script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
