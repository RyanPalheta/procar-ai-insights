

# Ajustes na Tela de Configuracoes e PlaybookManager

## Resumo
Tres alteracoes: (1) remover o card "Simulador de Score" da aba "Configuracoes de IA", (2) transformar o dialog de visualizacao de playbook em um dialog de edicao (com textarea editavel + botao salvar), e (3) mover o upload de substituicao para dentro da tabela de playbooks cadastrados (uma coluna extra com input de arquivo + botao substituir), eliminando a secao separada "Importar Playbooks" por tipo.

---

## 1. Settings.tsx - Remover Simulador de Score

Remover o terceiro Card da tab "ai-settings" (linhas ~113-125 do Settings.tsx) que mostra "Simulador de Score - Funcionalidade em desenvolvimento".

## 2. PlaybookManager.tsx - Editar conteudo do playbook

### Dialog de visualizacao vira dialog de edicao
- Trocar o `div` de texto read-only por um `Textarea` editavel com o conteudo do playbook
- Adicionar estado `editContent` para controlar o texto editado
- Adicionar botao "Salvar" no dialog que faz `supabase.from('playbooks').update({ content }).eq('id', ...)`
- Manter o botao de fechar e o titulo/badge como estao
- Icone do botao na tabela muda de `Eye` para `Pencil` (ou manter Eye + adicionar Pencil)

### Upload de substituicao na tabela de cadastrados
- Adicionar uma coluna "Substituir" na tabela de playbooks cadastrados
- Cada linha tera um input file + botao de upload inline (compacto)
- Reutilizar a logica `handlePlaybookFileChange` e `handleUploadPlaybook` ja existente
- Remover o card "Importar Playbooks" separado (a secao de grid com cards por tipo)
- Manter apenas um card simples no final para importar playbook de tipo **novo** (sem playbook cadastrado ainda), usando um select de tipo + input file

## 3. Arquivos modificados

- `src/pages/Settings.tsx` - remover Card do Simulador de Score
- `src/components/settings/PlaybookManager.tsx` - edicao no dialog, substituicao inline na tabela, remover secao de import separada

---

## Detalhes Tecnicos

### PlaybookManager - Mudancas principais

**Estado novo:**
```text
editContent: string  -- conteudo editavel no dialog
editingPlaybook: any  -- playbook sendo editado (substitui viewingPlaybook)
savingPlaybook: boolean  -- loading do salvar
replaceFiles: { [playbookId: string]: File }  -- arquivos para substituicao por linha
```

**Dialog de edicao:**
- Ao abrir, `editContent` recebe `playbook.content`
- Textarea com `min-h-[50vh]` dentro do ScrollArea
- Botao "Salvar Alteracoes" que faz update no Supabase e invalida query

**Tabela com coluna "Substituir":**
- Nova coluna com input file compacto + botao Upload
- Ao selecionar arquivo e clicar upload, substitui o conteudo do playbook existente
- Acoes ficam: Editar (Pencil) | Substituir (Upload file) | Excluir (Trash2)

**Importar novo playbook:**
- Card simples com Select de product_type (filtrando os que ja tem playbook) + input file + botao importar
