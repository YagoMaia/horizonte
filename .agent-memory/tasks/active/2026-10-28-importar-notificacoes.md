# Tarefa: Importação de compras por notificações

- Status: Implementada; validação nativa pendente
- Data: 2026-10-28 BRT
- Objetivo: captura Android autorizada, regras por aplicativo e modalidade, automação/revisão, deduplicação.
- Entrega: IMPORTACAO_NOTIFICACOES.md; Menu → Importar compras de notificações; módulo Expo local, fila privada persistente, regras crédito/débito, revisão e idempotência financeira.
- Arquitetura: NotificationListenerService captura somente pacotes ativados; processamento serializado ao abrir/retornar ao app e a cada 10s em primeiro plano. Capturas com app fechado são processadas ao reabrir.
- Critérios concluídos: modos independentes, destinos compatíveis, ambiguidade/parcelas para revisão, débito realizado/crédito pendente, proteção contra duplicatas e limpeza de capturas ao apagar dados.
- Verificações: TypeScript aprovado; autolinking reconheceu CaptureModule; suíte geral 24 suítes/166 testes aprovada e dois testes novos da interface aprovados separadamente. Quatro testes privados ignorados por arquivo ausente. git diff --check aprovado.
- Pendência material: Kotlin não compilado/testado no aparelho. SDK Android existe, JDK/Java não disponível no ambiente e nenhum S23 conectado. Sem APK gerado nesta tarefa.
- Próxima etapa: gerar APK via EAS e executar roteiro nativo documentado, incluindo permissões e notificações reais do banco.
