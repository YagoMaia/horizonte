# Tarefa: Importação de compras por notificações

- Status: Implementada e corrigida; Kotlin compilado; validação física pendente
- Data: 2026-10-28 BRT
- Objetivo: captura Android autorizada, regras por aplicativo e modalidade, automação/revisão, deduplicação.
- Entrega: IMPORTACAO_NOTIFICACOES.md; Menu → Importar compras de notificações; módulo Expo local, fila privada persistente, regras crédito/débito, revisão e idempotência financeira.
- Arquitetura: NotificationListenerService captura somente pacotes ativados; processamento serializado ao abrir/retornar ao app e a cada 10s em primeiro plano. Capturas com app fechado são processadas ao reabrir.
- Critérios concluídos: modos independentes, destinos compatíveis, ambiguidade/parcelas para revisão, débito realizado/crédito pendente, proteção contra duplicatas e limpeza de capturas ao apagar dados.
- Atualização 29/10: seis achados da revisão corrigidos; ver CORRECOES_IMPORTACAO_NOTIFICACOES.md. Destinos por final, conferência de duplicatas, barreira de limpeza, armazenamento/lotes/lista limitados, reconciliação de regras e revisão integrada de parcelas.
- Verificações: TypeScript, 27 suítes/191 testes gerais e compilação Kotlin do módulo aprovados. Recorte específico: 57 testes em seis suítes. Quatro testes privados ignorados por arquivo ausente. git diff --check aprovado.
- Ambiente: Java 17 localizado em C:/Users/pedro/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2, fora do PATH; SDK disponível. Compilação :horizonte-notification-capture:compileDebugKotlin concluída com sucesso em 6m42s. Nenhum aparelho conectado no ADB.
- Pendência material: APK completo e comportamento real no S23 ainda não validados. Compilar o módulo não confirma entrega das notificações pelo Android/bancos.
- Próxima etapa: gerar APK e executar roteiro no aparelho, incluindo permissões, reinício, capturas reais e duplicatas.
- Integração Android adicional aprovada: :app:processDebugMainManifest, concluída em 3m25s; correções de código detalhadas em tasks/completed/2026-10-29-correcoes-importacao.md.
