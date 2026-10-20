# Tarefa: correções da tela Menu

## Estado

- Status: Concluída
- Criada em: 2026-10-18 BRT
- Última atualização: 2026-10-18 BRT
- Responsável: Codex + usuário

## Objetivo

Corrigir exportação CSV, permissões e horários de notificações, feedback de operações de dados, sinalização de ações destrutivas e acessibilidade da tela Menu.

## Critérios de aceitação

- [x] CSV preserva data, tipo de transferência e campos seguros para planilhas.
- [x] Notificações pedem permissão somente quando necessário e exibem o horário ativo.
- [x] Operações de arquivo e manutenção informam processamento e evitam acionamento repetido.
- [x] Ações e modais têm controles acessíveis para uso móvel.
- [x] Testes novos e suíte completa aprovados.

## Próximos passos

1. Correções registradas em `CORRECOES_MENU.md`.

## Verificações

- TypeScript sem erros.
- 16 suítes e 93 testes aprovados com backup privado no ambiente local.
- `git diff --check` aprovado.

## Resultado / handoff

- Resultado: concluído. Ver `CORRECOES_MENU.md`.
- Limitações conhecidas: seletor de arquivos, compartilhamento, permissões e entrega de notificação precisam de validação em Android físico.
