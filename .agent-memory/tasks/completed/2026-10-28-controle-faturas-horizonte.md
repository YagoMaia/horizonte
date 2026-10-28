# Tarefa: Controle de faturas no Horizonte

- Status: Concluída
- Data: 2026-10-28 BRT
- Objetivo: disponibilizar na tela principal do Horizonte o controle de reserva das faturas no primeiro dia dos próximos meses.
- Resultado: controle Faturas no dia 1 visível em lista/grade; escolha persistida; falhas de gravação informadas.
- Decisão: ativar inclui cartões mesmo se anteriormente excluídos; desativar muda apenas o momento da reserva para o vencimento quando incluídos. Mês atual permanece no vencimento.
- Arquivos: components/screens/HorizonteScreen.tsx, lib/horizonProjection.ts e testes correspondentes.
- Verificações: TypeScript, git diff --check e 18 testes específicos aprovados.
- Limite: sem teste físico no S23.
