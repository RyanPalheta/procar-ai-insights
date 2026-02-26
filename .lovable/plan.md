

# Ajustes: Remover importacao em massa e filtros colapsaveis

## 1. Remover "Importar Produtos em Massa" do ProductManager

No arquivo `src/components/settings/ProductManager.tsx`, remover o card "Importar Produtos em Massa" (linhas 456-522) e os estados associados (`excelFile`, `productsPreview`, `uploadingProducts`) e as funcoes `handleExcelFileChange` e `handleUploadExcel`. Tambem remover o import do `xlsx`.

## 2. Filtros colapsaveis na Visao Geral (Dashboard)

No arquivo `src/pages/Dashboard.tsx`, substituir o card de filtros sempre visivel por um botao "Filtros" que, ao ser clicado, expande/colapsa a barra de filtros.

### Implementacao:
- Adicionar estado `filtersOpen` (boolean, default `false`)
- Trocar o card fixo por um botao com icone `Filter` + texto "Filtros" + badge com contagem de filtros ativos
- Ao clicar, exibe o conteudo dos filtros (canal, status, lingua, datas, limpar) usando `Collapsible` do radix ou simplesmente um condicional com animacao
- Quando ha filtros ativos, o botao mostra um indicador visual (badge com numero)

### Detalhes tecnicos:
- O botao fica na area do header, ao lado dos botoes existentes (Notificacoes, Exportar)
- Conteudo dos filtros aparece abaixo do header em um card com animacao de slide
- Contagem de filtros ativos: somar quantos filtros estao diferentes de "all" ou tem valor definido (dateFrom, dateTo)

