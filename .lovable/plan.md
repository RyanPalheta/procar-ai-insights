

# Atualizar Plano: Remover Confirmacao de Email

## Alteracao
Adicionar ao plano ja aprovado a configuracao de **auto-confirm de email**, para que usuarios possam fazer login imediatamente apos o cadastro, sem precisar confirmar por email.

## Como sera feito
- Usar a ferramenta `configure-auth` para habilitar `autoconfirm: true` no momento da implementacao
- Isso sera aplicado junto com toda a implementacao de login + controle de acesso ja aprovada

## Impacto
- Usuarios criados (pelo admin) poderao fazer login imediatamente
- Nenhuma etapa adicional de verificacao de email sera necessaria
- Ideal para ambiente corporativo/interno como o da PROCAR

Todo o restante do plano original (tela de login com logo, tabela user_roles, controle admin/user, rotas protegidas) permanece inalterado.

