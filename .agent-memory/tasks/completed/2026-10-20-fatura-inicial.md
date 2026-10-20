# Tarefa: Fatura inicial do cartão

## Estado

- Status: Concluída
- Criada em: 2026-10-20 BRT
- Última atualização: 2026-10-20 BRT
- Responsável: Codex + usuário

## Objetivo

Fazer a tela Cartões abrir, por padrão, na próxima competência de fatura.

## Critérios de aceitação

- [x] Sem estado anterior salvo, outubro abre novembro.
- [x] Competência previamente escolhida continua sendo preservada ao voltar à tela.
- [x] Testes e verificação de tipos aprovados.

## Diário de execução

### 2026-10-20 BRT — início

- Confirmado que a tela inicializa a competência com o mês corrente, embora a expectativa seja abrir a próxima fatura.

### 2026-10-20 BRT — conclusão

- Alterada a competência padrão para o mês seguinte e mantida a restauração da escolha anterior.
- Acrescidos testes para outubro/novembro, dezembro/janeiro e atualização das expectativas anteriores.

## Verificações

- `tsc --noEmit`: aprovado.
- Jest com backup privado local: 21 suítes e 120 testes aprovados.
- `git diff --check`: aprovado.

## Resultado / handoff

- Resultado: concluído.
- Para retomar: `components/screens/CartaoScreen.tsx` e `CORRECOES_CARTOES.md`.
