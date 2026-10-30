# Interface de importação de notificações

- Status: concluída em 30/10/2026; validação física do recurso permanece na tarefa original.
- Solicitação: melhorar aparência e clareza da tela.
- Resultado: cabeçalho com retorno/atualização; cartão de permissão; abas Bancos/Para revisar; bancos com resumo das modalidades; edição de uma modalidade por vez; campos identificados; ações principais destacadas; total com hierarquia; notificação original recolhida; estados vazios e paginação mantidos.
- Preservado: regras e pendências existentes, serviço de captura, motor financeiro, confirmações de duplicatas e parcelas.
- Verificações: TypeScript aprovado; 13 testes da interface/provider aprovados. Testes existentes adaptados aos novos controles. Prévia web inspecionada em 320, 360 e 412 px, modo escuro; web exibe apenas estado sem módulo Android. Fluxos Android verificados pelos testes com módulos simulados, sem alegar validação física.
- Arquivos: app/notification-import.tsx, __tests__/notificationImportScreen.test.tsx e IMPORTACAO_NOTIFICACOES.md.
