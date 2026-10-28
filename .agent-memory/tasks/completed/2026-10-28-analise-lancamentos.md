# Tarefa: Análise de novos lançamentos

- Status: Concluída
- Data: 2026-10-28 BRT
- Objetivo: analisar criação de lançamentos e identificar correções necessárias, sem implementar mudanças funcionais nesta solicitação.
- Entrega: ANALISE_NOVOS_LANCAMENTOS.md.
- Achados confirmados: competências de parcelas incorretas para fechamentos 1/31; sobrescrita ao gravar a partir da mesma lista capturada; recorrências sem término limitadas silenciosamente a 24 ocorrências.
- Outros pontos: acessibilidade e áreas de toque insuficientes; teclado Android e calendário precisam de validação física.
- Verificações: 14 testes existentes aprovados; três cenários temporários reproduziram falhas e um confirmou limite de recorrências; TypeScript e git diff --check aprovados. Testes temporários removidos.
- Limites: sem validação visual/física e backup privado indisponível no caminho original.
- Próxima etapa possível: corrigir os achados por ordem de risco financeiro.
