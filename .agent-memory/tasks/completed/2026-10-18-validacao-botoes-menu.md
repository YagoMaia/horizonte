# Tarefa: validação dos botões da tela Menu

## Estado

- Status: Concluída
- Criada em: 2026-10-18 BRT
- Última atualização: 2026-10-18 BRT
- Responsável: Codex + usuário

## Objetivo

Verificar cada controle acionável da tela Menu por teste de interface ou inspeção do fluxo correspondente, sem executar ações destrutivas sobre os dados reais.

## Critérios de aceitação

- [x] Todos os botões, interruptores e escolhas de modal inventariados.
- [x] Fluxos internos e ações externas simuláveis validados.
- [x] Ações destrutivas verificadas por confirmação, sem alterar dados reais.
- [x] Resultado e limitações por dependência de dispositivo documentados.

## Próximos passos

1. Validação concluída em `VALIDACAO_BOTOES_MENU.md`.

## Verificações

- TypeScript sem erros.
- 15 suítes e 91 testes aprovados com backup privado no ambiente local.
- `git diff --check` aprovado.

## Resultado / handoff

- Resultado: concluído. Ver `VALIDACAO_BOTOES_MENU.md`.
- Limitações conhecidas: seletor de arquivos, compartilhamento, permissão e entrega de notificação precisam de validação em Android físico.
