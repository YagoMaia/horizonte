# Tarefa: Corrigir criação de lançamentos

- Status: Concluída
- Data: 2026-10-28 BRT
- Objetivo: corrigir todos os pontos de ANALISE_NOVOS_LANCAMENTOS.md.
- Critérios atendidos: parcelas consecutivas com fechamento 1/31; gravações serializadas e IDs exclusivos; quantidade de recorrências explícita/editável; controles acessíveis e layout adaptado a teclado/altura disponível.
- Motor: primeira competência centralizada e competências explícitas nas parcelas; edição de famílias preserva sequência; fila financeira usa referências atualizadas; recorrência respeita contagem de ocorrências válidas e limites.
- Formulário: quantidade de repetições, validação de datas, bloqueio de saída durante gravação, papéis/rótulos/seleções acessíveis, áreas de toque, teclado Android e calendário rolável.
- Arquivos: hooks/useStore.ts, app/add-transaction.tsx, constants/types.ts, lib/transactionInput.ts, testes de formulário/regressões e helper.
- Documento: CORRECOES_LANCAMENTOS.md; análise original anotada com o status.
- Verificações: TypeScript e git diff --check aprovados; 22 suítes/146 testes aprovados, quatro testes privados ignorados por ausência do arquivo. ESLint indisponível no node_modules.
- Limites: não foi possível validar fisicamente no S23; não houve migração automática dos parcelamentos históricos.
- Próxima etapa: validação no aparelho com APK atualizado e backup de segurança.
