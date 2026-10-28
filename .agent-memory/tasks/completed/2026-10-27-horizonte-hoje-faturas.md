# Tarefa: Horizonte — hoje e reserva de faturas

- Status: Concluída
- Data: 2026-10-27 BRT
- Objetivo: abrir Horizonte no dia atual, remover aviso de exclusão e reservar faturas dos meses futuros no primeiro dia.
- Resultado: rolagem inicial em lista e grade, recuperação de falha de medição, retorno a hoje, aviso removido e reserva de faturas futuras no dia 1.
- Critérios atendidos: faturas pendentes reservadas uma vez por competência; mês atual mantém vencimento; antecipações descontam apenas o restante; navegação direta e virada do ano cobertas.
- Arquivos: components/screens/HorizonteScreen.tsx, lib/horizonProjection.ts e testes correspondentes.
- Verificações: TypeScript, git diff --check e 14 testes específicos aprovados.
- Limites: sem validação física no S23.
