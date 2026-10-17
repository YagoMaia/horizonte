# Correções sequenciais

Objetivo: corrigir os seis achados prioritários do relatório, validando cada um antes de avançar.
Critérios: testes de regressão por defeito, suíte final e TypeScript aprovados; limitações registradas.
Escopo: baixa automática, ajustes/saldos, backup/restauração, edição de data, remoção de vínculos e metas realizadas. Corrigir infraestrutura de testes quando necessário para validar esses fluxos.
Plano: reproduzir, corrigir, testar e registrar cada defeito, em sequência.
Diário: iniciada revisão da infraestrutura de testes e do carregamento de pendências.

Marco 1: teste reproduziu baixa automática; removida baixa implícita e reconstruído saldo no carregamento. Teste aprovado.
Marco 2: teste reproduziu saldo desatualizado ao limpar ajustes; adicionado recálculo e aviso explícito sobre saldo inicial. Dois testes aprovados.

Marco 3: edição de data reproduzida e corrigida; persistência e efeito no saldo validados.
Marco 4: remoção explícita de vínculos corrigida; campos omitidos continuam preservados.
Marco 5: metas contam apenas aportes realizados até hoje, com divisão em centavos entre metas; regra informada no formulário.
Marco 6: backup v2 completo, validação, migração legada, rollback com diário persistente e atualização imediata do estado/tema. 18 testes aprovados; TypeScript aprovado após ajuste de readonly.
Próximo passo: ajustar mocks e contrato do teste legado de projetos e executar suíte final.

Conclusão: seis achados prioritários corrigidos sequencialmente. O teste adicional de orçamento de janeiro detectou uma incompatibilidade na nova validação e foi corrigido antes do encerramento.
Validação final: 26 testes aprovados em 4 suítes; TypeScript aprovado; git diff --check sem erros. ESLint indisponível nesta instalação.
Arquivos relevantes: hooks/useStore.ts, lib/backup.ts, app/add-transaction.tsx, components/screens/MenuScreen.tsx, context/ThemeContext.tsx, três arquivos de testes e CORRECOES_VALIDACAO.md.
Limitações: sem validação visual/dispositivo; dependências e refatoração ampla não alteradas. Backups legados não recuperam dados que nunca foram exportados.
Status: concluída.
