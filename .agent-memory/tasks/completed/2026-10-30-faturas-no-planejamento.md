# Faturas no dia 1 dentro de Planejamento

- Estado: concluída em 30/10/2026.
- Solicitação: mover a chave de reserva de faturas do Horizonte para a tela de Planejamento.
- Resultado: controle e erro de gravação no conteúdo rolável de Planejamento, junto das opções de cartões. Preferência e motor de projeção preservados.
- Verificação: TypeScript e nove testes existentes do Horizonte aprovados, adaptados para abrir o planejamento antes de interagir com a chave; incluem persistência, lista/grade e falha de gravação.
- Arquivos: components/screens/HorizonteScreen.tsx e __tests__/horizonte.test.tsx.
