# Análise da tela Totais

Data: 18 de outubro de 2026  
Escopo: comportamento financeiro, consistência dos gráficos, desempenho, privacidade e uso em telas móveis. Esta entrega é diagnóstica; não altera o funcionamento da tela.

## Como a tela funciona hoje

A tela permite consultar semana, mês ou ano, separa as transações por débito, crédito ou total e exibe cartões de resultado, um gráfico por categoria e um gráfico por período. A organização visual é configurável por meio de `totaisLayout`.

Há bons elementos de base: os cálculos principais são memorizados, os gráficos recebem somente o período selecionado e a lista de categorias permite chegar aos lançamentos que a compõem.

## Problemas confirmados

| Prioridade | Problema | Efeito prático |
|---|---|---|
| Alta | Datas no formato `AAAA-MM-DD` são interpretadas diretamente com `new Date(...)`. No fuso do Brasil, `2026-11-01` passa a ser 31 de outubro localmente. | Um lançamento de novembro pode aparecer em outubro, ficar fora do filtro semanal e cair na barra ou categoria errada. |
| Alta | O modo **Total** soma a compra no cartão e também o pagamento da fatura como despesas independentes. | O gasto pode ser contado duas vezes, especialmente quando compra e pagamento ocorrem no mesmo período. |
| Alta | Os cartões de resumo ignoram compras no crédito, enquanto o gráfico Total as inclui. | “Resultado”, “Custo de vida” e “Média diária” podem divergir do gráfico mostrado na mesma tela. |
| Média | O filtro global de pendências não é explicado nem controlado na tela. Ele pode incluir lançamentos previstos junto com realizados. | O usuário não consegue saber se o total representa gastos efetivos, planejamento ou ambos. |
| Média | Com pendências ocultas, uma transação paga com data futura ainda é incluída. | Totais realizados podem antecipar receitas ou despesas futuras. |
| Média | A média semanal sempre divide por sete, mesmo em uma semana ainda em andamento. | A média diária da semana atual fica artificialmente menor. |
| Média | A tela refaz filtros e agregações próprias em vez de usar o índice financeiro compartilhado. | Há mais processamento em listas grandes e regras diferentes das telas Saldos, Cartões e Horizonte. |
| Média | Não existem testes automatizados específicos para Totais. | Regressões de período, cartão, categoria e fuso horário não são detectadas antes da entrega. |
| Baixa | A tela não respeita o modo de ocultar valores usado nas demais telas principais. | Valores financeiros permanecem expostos em Totais mesmo quando a privacidade foi ativada em Saldos, Cartões ou Horizonte. |
| Baixa | Alguns controles têm área de toque pequena e não possuem descrição de acessibilidade; o mês e o ano só podem ser alcançados avançando ou voltando período a período. | A navegação é menos confortável no celular e pior para leitores de tela. |

## Evidências técnicas

### Datas deslocadas pelo fuso horário

O filtro principal, o gráfico de barras e a ordenação da lista da categoria usam `new Date(transacao.date)`. Em um dispositivo configurado para o horário de São Paulo, uma data sem horário representa meia-noite UTC e pode voltar para o dia anterior local. A aplicação já possui `financialDate`, usado nas outras telas para tratar esse tipo de data com segurança, mas Totais ainda não o utiliza.

### Contagem dupla de cartão

Uma compra no cartão é lançada como despesa no momento da compra. Ao pagar a fatura, o aplicativo cria uma nova despesa de débito vinculada ao cartão. O gráfico Total agrupa as duas como despesas. O pagamento costuma ainda aparecer como “Outros” porque não recebe a categoria original da compra, distorcendo o gráfico por categoria.

O resumo segue outra regra: exclui compras de crédito, mas inclui o pagamento de débito. Portanto, ele mede uma visão de caixa parcial, enquanto o gráfico Total mistura visão de competência e de caixa.

### Pendências e datas futuras

`showPending` vem do estado global e não é apresentado na tela. Quando está desligado, a condição verifica somente `paid`; não compara a data da transação com o dia atual. Assim, um item marcado como pago, mas datado no futuro, integra o período selecionado.

### Responsividade e acessibilidade

Os gráficos SVG se redimensionam visualmente, o que é uma base adequada para o S23 e outros tamanhos. Ainda assim, os botões de navegação do período têm cerca de 28 px, abaixo da área confortável de toque em celular, e os elementos interativos dos gráficos não informam função ou valor para tecnologias assistivas. O modal de categorias também não acompanha a preferência de ocultar valores.

## Correções recomendadas

1. Centralizar os cálculos de Totais em uma função pura baseada em `financialIndex` e `financialDate`.
2. Definir de forma explícita a visão financeira exibida: competência (compras) ou caixa (pagamentos), sem somar compra e quitação da mesma fatura no mesmo total.
3. Fazer cartões, gráfico de categorias e gráfico de período consumirem o mesmo conjunto de dados e a mesma regra de cartão.
4. Exibir e controlar claramente a inclusão de lançamentos pendentes; ao mostrar somente realizados, considerar também o dia atual.
5. Corrigir a média semanal para usar apenas os dias transcorridos no período atual.
6. Compartilhar `hiddenValues` com Totais e seus gráficos e modais.
7. Aumentar áreas de toque, adicionar rótulos de acessibilidade e oferecer seletor direto de mês e ano.
8. Criar testes para datas `AAAA-MM-DD`, semanas, mês, ano, compra e pagamento de fatura, pendências, valores ocultos e períodos vazios.

## Ordem sugerida

Primeiro devem ser corrigidas as regras de data e de cartão, pois alteram os valores apresentados. Em seguida, é indicado unificar o cálculo dos cartões e gráficos, acrescentar a transparência de pendências e então concluir os ajustes de privacidade, responsividade e acessibilidade.
