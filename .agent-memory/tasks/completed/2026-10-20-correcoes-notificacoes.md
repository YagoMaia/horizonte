# Tarefa: Correções de notificações

## Estado

- Status: Concluída
- Criada em: 2026-10-20 BRT
- Última atualização: 2026-10-20 BRT
- Responsável: Codex + usuário

## Objetivo

Corrigir os problemas confirmados de notificações locais e validar o fluxo com testes automatizados.

## Critérios de aceitação

- [x] Criar o canal Android antes da solicitação de permissão.
- [x] Usar gatilhos diários e de teste compatíveis com a versão instalada do Expo.
- [x] Propagar falhas de agendamento para que a preferência não indique sucesso incorreto.
- [x] Corrigir primeiro uso, restauração e limpeza de dados.
- [x] Remover controles que prometem lembrete por lançamento sem implementar essa função.
- [x] Validar TypeScript e testes específicos/regressão.

## Diário de execução

### 2026-10-20 BRT — conclusão

- O serviço foi refeito com canal preparado antes da permissão e gatilhos explicitamente tipados.
- Preferências são persistidas somente depois de agendar ou cancelar com sucesso.
- O primeiro uso inicia sem lembretes ativos; restauração e abertura preservam escolhas anteriores apenas quando a permissão já existe.
- A limpeza agora cancela os lembretes e o controle inoperante de vencimento foi removido.
- Detalhes em `CORRECOES_NOTIFICACOES.md`.

## Verificações

- `node node_modules/typescript/bin/tsc --noEmit`: aprovado.
- `node node_modules/jest/bin/jest.js --runInBand --silent` com backup privado local: 17 suítes e 101 testes aprovados.
- `npx expo config --type public`: aprovado.
- `git diff --check`: aprovado.

## Resultado / handoff

- Resultado: correções concluídas e documentadas em `CORRECOES_NOTIFICACOES.md`.
- Limitações conhecidas: APK novo e teste físico no Galaxy S23 ainda são necessários para validar permissão, canal e economia de bateria.
- Para retomar: gerar APK, instalar no S23 e executar o teste de cinco segundos seguido de um lembrete diário.

