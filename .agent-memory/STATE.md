Projeto: Horizonte, aplicativo móvel de finanças.
Tarefa atual: tasks/active/2026-10-28-importar-notificacoes.md
Estado: seis achados da importação corrigidos; testes gerais e compilação Kotlin aprovados; validação física pendente.
Entrega: IMPORTACAO_NOTIFICACOES.md; cabeçalho → Importar (ao lado de Horizonte), regras por app/crédito/débito, revisão, fila nativa e deduplicação.
Decisões: captura opt-in; processamento a cada 10s em primeiro plano e ao retornar. App fechado guarda capturas para processamento ao reabrir; ambiguidades/parcelas vão para revisão.
Verificações em 29/10: TypeScript, 27 suítes/191 testes gerais, compilação Kotlin e manifesto principal Android aprovados; 57 testes específicos. Quatro testes privados ignorados por arquivo ausente.
Correções: destinos por final, revisão de duplicatas, barreira de limpeza, corpos em linhas separadas e lotes/páginas limitados, reconciliação de regras e parcelas integradas. Ver CORRECOES_IMPORTACAO_NOTIFICACOES.md.
Ambiente: Java 17 localizado no cache Gradle, fora do PATH; SDK disponível. Sem APK gerado ou aparelho conectado.
Próxima etapa: APK e roteiro de validação física no S23 com mensagens reais dos bancos.
Interface em 30/10: importação acessível em Saldos; atalho mês atual removido de Saldos; Faturas no dia 1 agora dentro de Planejamento do Horizonte (tipos e nove testes aprovados).
Importação em 30/10: interface reorganizada em Bancos e Para revisar, com edição separada de crédito/débito; TypeScript e 13 testes aprovados. Ver tasks/completed/2026-10-30-visual-importacao.md.
