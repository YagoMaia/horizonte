# Tarefa: Cancelar pagamento de fatura

## Estado

- Status: Concluída
- Criada em: 2026-10-20 BRT
- Última atualização: 2026-10-20 BRT
- Responsável: Codex + usuário

## Objetivo

Disponibilizar uma ação clara para cancelar, no aplicativo, um pagamento de fatura registrado indevidamente e reabrir a cobrança.

## Critérios de aceitação

- [x] A fatura com pagamento registrado apresenta botão Cancelar pagamento.
- [x] A confirmação reverte apenas o registro local e explica que não opera o banco.
- [x] Testes e verificação de tipos aprovados.

## Diário de execução

### 2026-10-20 BRT — início

- Confirmado que já existe estorno por registro, porém com rótulo pouco claro para cancelar um pagamento lançado incorretamente.

### 2026-10-20 BRT — conclusão

- Renomeada a ação por pagamento para "Cancelar pagamento" e atualizada a confirmação para explicar o efeito local.
- Coberto o acionamento da reversão de uma fatura paga por engano.

## Verificações

- `tsc --noEmit`: aprovado.
- Jest com backup privado local: 22 suítes e 130 testes aprovados.
- `git diff --check`: aprovado.

## Resultado / handoff

- Resultado: concluído.
- Para retomar: `components/screens/CartaoScreen.tsx` e `CORRECOES_CARTOES.md`.
