// Estilos compartilhados dos gráficos recharts.
//
// IMPORTANTE (tema escuro): o recharts pinta o texto de cada item do tooltip
// ("nome : valor") com a COR DA SÉRIE/CÉLULA. Quando a barra usa <Cell fill>,
// a cor herdada some no fundo escuro (texto preto sobre card escuro). Por isso
// SEMPRE passe `itemStyle` e `labelStyle` junto com `contentStyle` nos tooltips
// crus do recharts — use os helpers abaixo.

export const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

export const GRID_STROKE = "hsl(var(--border) / 0.5)";

export const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

// Cor do valor de cada item (sobrescreve a cor escura herdada da série/célula).
export const TOOLTIP_ITEM_STYLE = { color: "hsl(var(--foreground))" };

// Cor do rótulo/título do tooltip (ex.: o eixo X / nome do canal).
export const TOOLTIP_LABEL_STYLE = { color: "hsl(var(--muted-foreground))" };
