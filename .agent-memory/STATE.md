Projeto: Horizonte, aplicativo móvel de finanças.
Tarefa atual: tasks/active/2026-10-28-importar-notificacoes.md
Estado: implementação da importação pronta no código; compilação e validação nativa pendentes.
Entrega: IMPORTACAO_NOTIFICACOES.md; Menu → Importar compras de notificações, regras por app/crédito/débito, revisão, fila nativa e deduplicação.
Decisões: captura opt-in; processamento a cada 10s em primeiro plano e ao retornar. App fechado guarda capturas para processamento ao reabrir; ambiguidades/parcelas vão para revisão.
Verificações: TypeScript/autolinking aprovados; 166 testes gerais mais dois novos de interface aprovados. Quatro testes privados ignorados por arquivo ausente.
Limites: SDK localizado, mas Java indisponível; módulo Kotlin não compilado, sem APK ou teste físico.
Próxima etapa: build EAS e roteiro de validação no S23.
