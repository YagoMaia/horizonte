# Tarefa: correções da tela Horizonte

## Estado

- Status: Concluída
- Criada e concluída em: 2026-10-18 BRT
- Responsável: Codex + usuário

## Objetivo

Corrigir os problemas diagnosticados na projeção Horizonte e validar as regras financeiras e a interface móvel.

## Entrega

- Novo motor puro em `lib/horizonProjection.ts`.
- Faturas no vencimento, competência atual e vencida, controles de contas/faturas, preferências estáveis e orçamento brasileiro validado.
- Tela reestruturada para privacidade compartilhada, seletor direto de mês, modais móveis e lista virtualizada.
- Testes: `horizonProjection.test.ts` e `horizonte.test.tsx`.

## Verificações

- TypeScript aprovado.
- 13 suítes / 82 testes aprovados com o backup privado opt-in, sem modificar o original.
- `git diff --check` aprovado.

## Limitações

Sem execução no S23 físico, medição de FPS ou APK. ESLint não está instalado localmente.
