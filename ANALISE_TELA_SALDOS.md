# Análise detalhada da tela Saldos

> Diagnóstico histórico anterior às correções. Consulte [CORRECOES_SALDOS.md](CORRECOES_SALDOS.md) para implementação, testes e medição de desempenho.

Data: 17/10/2026. Análise do código atual, após as correções anteriores.

## Parecer

A tela funciona como um painel financeiro, reunindo saldo, contas, cartões, projetos, metas e lançamentos. Sua estrutura é útil, mas a interpretação dos números ainda é pouco consistente: mistura saldo realizado, movimentos previstos, resultado mensal e valores acumulados, sem delimitar claramente o período e o significado de cada bloco.

Os principais riscos não são estéticos. São a projeção futura incompleta, a possibilidade de o saldo principal divergir dos cards por tratamento de datas, e a falta de indicação de pagamento na lista principal.

## Escopo e evidências

- Leitura de SaldosScreen.tsx, TransactionItem.tsx, useStore.ts, utils.ts, navegação, modal de projeto, detalhes de lançamento e configuração do layout.
- Sete cenários diagnósticos executados com React Native Testing Library, renderizando os componentes reais e simulando contexto, relógio e integrações nativas. Todos confirmaram os comportamentos descritos. Isso confirma a reprodução, não a correção dos defeitos.
- Verificação independente do tratamento de datas no fuso America/Sao_Paulo.
- Não houve inspeção visual em aparelho ou navegador nem medição de desempenho. Avaliações de legibilidade e acessibilidade abaixo derivam do código e precisam de validação visual.
- Nenhum código funcional foi alterado nesta análise. O teste temporário foi removido após registrar os resultados.

## 1. Organização e regras atuais

| Bloco | Conteúdo | Recorte aplicado |
|---|---|---|
| Saldo principal no mês atual | Soma dos saldos de contas que não são cartão | Valores realizados, conforme o store |
| Saldo principal no passado | Receitas menos despesas do mês | Inclui pendentes; exclui ajustes, transferências e compras no crédito |
| Saldo principal no futuro | Saldo atual mais receitas menos despesas do mês escolhido | Não acumula meses intermediários; não projeta faturas |
| Dois valores menores no resumo | Receitas e despesas | Mês selecionado, sem separar pago/pendente; exclui crédito |
| Contas | Saldo recalculado dentro da própria tela | Lançamentos pagos até o fim do dia atual |
| Cartões | Total da fatura aberta correspondente à data de hoje | Somente lançamentos até hoje; inclui itens pagos no total da fatura |
| Projetos | Receitas, gastos, disponível e consumo do orçamento | Todos os lançamentos do projeto, inclusive futuros/pendentes |
| Metas | Aportes realizados, alvo e previsão | Acumulado até hoje; não acompanha o mês selecionado |
| Lançamentos | Lista ordenada da data mais recente para a mais antiga | Mês selecionado; filtros de tipo e conta; exclui ajustes |

A ordem e a visibilidade dos blocos são configuráveis. A lista começa com 20 itens e acrescenta outros 20 ao aproximar-se do fim. O botão central da navegação abre o formulário de lançamento; o atalho Horizonte abre a área específica de projeção.

## 2. Achados de impacto financeiro

### A. Alta — saldo projetado omite parte do fluxo de caixa

Referências: components/screens/SaldosScreen.tsx:96 e 109, especialmente linha 131.

A fórmula considera apenas o movimento do mês selecionado. Ao olhar dezembro, não carrega as pendências restantes de outubro nem as entradas e saídas de novembro.

Cenário reproduzido, com data atual fixada em 17/10/2026:

- Saldo atual: R$ 1.000.
- Despesa pendente em outubro: R$ 500.
- Despesa em novembro: R$ 300.
- Receita em dezembro: R$ 200.
- Tela em dezembro: R$ 1.200.
- Projeção acumulada desses movimentos até dezembro: R$ 400.

Além disso, receitas e despesas no crédito são excluídas de monthlyStats, e a tela não gera o pagamento futuro da fatura. Outro cenário reproduziu compra de R$ 400, com fechamento dia 25 e vencimento dia 5: ao consultar novembro, a projeção continuou em R$ 1.000, sem reservar a fatura.

Encaminhamento: definir uma projeção acumulada até o fim do período, com pendências e faturas por vencimento, evitando contar compra e pagamento duas vezes. Reutilizar a regra financeira da área Horizonte após validá-la, em vez de manter uma fórmula independente simplificada.

### B. Alta — saldo principal e card da conta podem divergir por fuso horário

Referências: hooks/useStore.ts:90; components/screens/SaldosScreen.tsx:138 e 323.

O store extrai o dia textual do ISO; a tela compara o instante convertido para o horário local. As duas interpretações não são equivalentes.

Exemplo confirmado em America/Sao_Paulo: um movimento realizado em 17/10 às 22h tem ISO 2026-10-18T01:00:00.000Z. O store o interpreta como dia 18 e o exclui do saldo de dia 17; o card da conta o inclui como movimento de dia 17. O total principal pode não bater com a soma das contas.

Também há risco na importação de datas sem horário: 2026-11-01 vira 31/10 às 21h quando interpretada por new Date no fuso de Brasília, afetando mês e data exibidos.

Encaminhamento: escolher uma representação única para a data financeira e centralizar o cálculo do saldo. O card não deve manter um segundo motor de cálculo com regras distintas.

### C. Alta para clareza operacional — a lista esconde o estado pago/pendente

Referências: components/screens/SaldosScreen.tsx:521; components/TransactionItem.tsx:90.

A tela passa hideIcon=true. No componente de lançamento, isso também desativa o indicador de pagamento. Um lançamento pago e um pendente aparecem sem distinção explícita de status na lista. O comportamento foi reproduzido.

Após a remoção da baixa automática, essa informação ficou ainda mais importante: é necessário abrir os detalhes e editar para confirmar pagamento/recebimento. A tela principal não oferece filtro por status nem confirmação direta de pagamento.

Encaminhamento: tornar o status independente do ícone de categoria e mostrar Pago/Recebido, Previsto ou Vencido. Acrescentar filtro por status e, se desejado, uma ação clara para confirmar a realização.

### D. Média — totais mensais misturam realizado e previsto

Referência: components/screens/SaldosScreen.tsx:84–106.

Receitas e despesas não filtram paid. O teste confirmou que uma receita futura e pendente de R$ 3.000 aparece no subtotal de receitas junto de um Saldo Atual de R$ 1.000. Isso pode ser uma visão planejada válida, mas o card não explica a diferença.

Os dois subtotais usam somente setas e valores, sem rótulos textuais de receita/despesa ou realizado/previsto. No passado, Balanço do Mês também inclui pendências e não corresponde a um saldo histórico de fechamento.

Encaminhamento: separar realizado e previsto ou rotular explicitamente a visão planejada. Manter a distinção entre resultado do mês e saldo final do mês.

### E. Média — transferências são exibidas como despesas em qualquer conta

Referências: components/TransactionItem.tsx:50 e 105; components/screens/SaldosScreen.tsx:160 e 509.

A lista usa sinal positivo apenas para receitas. Transferências recebem sinal negativo e cor de despesa. O filtro de conta inclui tanto origem quanto destino, mas o item continua mostrando a conta de origem e um valor negativo mesmo quando consultado pela conta que recebeu o dinheiro.

Isso não indica erro no recálculo dos saldos; é um erro de apresentação. Nos detalhes, a transferência já recebe tratamento diferente, reforçando a inconsistência.

Encaminhamento: mostrar origem → destino e apresentação neutra na visão geral; na visão por conta, diferenciar entrada e saída conforme o papel da conta selecionada.

### F. Média — projetos usam termos de dinheiro realizado para valores previstos

Referências: components/screens/SaldosScreen.tsx:190 e 390; hooks/useStore.ts:1149.

O cálculo de projetos soma todos os lançamentos vinculados, sem filtrar pagamento ou data. Por isso, Juntei e Disponível podem incluir uma receita que ainda não foi recebida. A barra representa gasto/orçamento, enquanto o disponível é receita menos gasto, e não orçamento menos gasto.

São medidas diferentes e potencialmente úteis, mas precisam de nomes claros. Exemplo: orçamento de R$ 5.000, receita zero e gasto R$ 200 resulta em Disponível: -R$ 200, apesar de restarem R$ 4.800 no orçamento.

Encaminhamento: diferenciar Saldo do projeto, Orçamento restante e valores previstos; indicar o que a barra mede.

## 3. Período, filtros e navegação

- **Escopo do mês:** o seletor aparece dentro de Lançamentos, mas altera também o saldo principal e seus subtotais. Contas, cartões, projetos e metas não passam a representar aquele mês. O cabeçalho do saldo não mostra a competência escolhida.
- **Ocultação da lista:** ocultar Lançamentos também oculta o seletor de mês, embora o resumo financeiro tenha comportamento dependente do mês.
- **Filtros:** tipo e conta afetam somente a lista. Um cenário confirmou R$ 100 na conta filtrada e R$ 300 no subtotal geral. Não é necessariamente um cálculo errado, porque o filtro fica na seção da lista, mas o escopo deveria ser explícito.
- **Aplicar filtros:** selecionar opções já altera o estado; o botão apenas fecha o modal. Fechar pelo X ou fundo mantém a seleção. O nome sugere uma confirmação que não existe.
- **Retorno ao mês atual:** não existe atalho Hoje/Mês atual. O usuário precisa navegar pelas setas.
- **Retorno à aba:** a navegação principal troca o componente da tela; ao sair de Saldos e voltar, o estado local é recriado, perdendo mês, filtros e paginação.
- **Cards:** projetos são tocáveis e abrem detalhes. Contas/cartões e metas são Views sem ação, apesar de terem aparência de cards semelhantes. Não funcionam como atalhos.
- **Estado vazio:** Nenhum lançamento em [mês] também aparece quando há lançamentos, mas os filtros os excluem. Melhor diferenciar mês sem movimentos de busca sem resultados e oferecer limpeza dos filtros.
- **Paginação:** há carregamento em lotes, mas não há contador de resultados ou indicação clara de fim da lista. Se outros blocos estiverem após Lançamentos, ficam no rodapé e podem exigir bastante rolagem.

## 4. Metas e atualização temporal

Referências: components/screens/SaldosScreen.tsx:208–225.

O valor guardado utiliza a regra corrigida anteriormente, considerando realização e divisão entre metas. A previsão de conclusão ainda tem duas falhas reproduzidas:

1. **Aporte mensal zero:** a divisão gera Infinity e a tela mostra Invalid Date/NaN. O cadastro normal impede zero, mas a validação de backup atual permite esse valor; portanto, o cenário pode ocorrer por importação.
2. **Último dia do mês:** partindo de 31/10, adicionar um mês via setMonth pode resultar em 01/12, quando o esperado para a previsão mensal seria novembro.

Encaminhamento: mostrar Sem previsão quando não houver aporte positivo e utilizar aritmética de calendário que limite o dia ao fim do mês.

A tela também não tem atualização dedicada à virada de dia ou retorno do aplicativo ao primeiro plano. Há cálculos com new Date dentro de useMemo que dependem somente de dados, não de um relógio. Se o app permanecer aberto, datas e classificações temporais podem ficar antigas até outra atualização. Esse risco foi identificado no código, sem teste de longa duração em dispositivo.

## 5. Usabilidade, acessibilidade e apresentação

Pontos positivos:

- Saldo em destaque e separação em blocos reconhecíveis.
- Componentes adaptados ao tema claro/escuro e valores em reais.
- Layout personalizável sem exigir alterar dados financeiros.
- Lista virtualizada e detalhes acessíveis por toque.
- Confirmação antes de excluir e tratamento específico para famílias de lançamentos.

Pontos a validar/melhorar:

- Botões somente com ícones — setas, filtros e adicionar — não têm nomes acessíveis explícitos no código examinado.
- Os subtotais dependem de setas e cores para comunicar significado; transferências e despesas compartilham apresentação negativa.
- Saldo principal usa fonte de 36 e cards de conta têm largura fixa de 140; valores longos e fontes ampliadas precisam de teste real. Não foi confirmado corte visual.
- Textos secundários variam entre 10 e 12; leitura e contraste dependem do dispositivo e da cor escolhida pelo usuário. Não foi feita avaliação formal de contraste.
- Não há opção local de ocultar valores financeiros na tela inicial.
- Não existe busca textual por descrição, filtro de vencidos ou agrupamento por dia. São oportunidades de produto, não defeitos de cálculo.
- Ajustes de saldo são omitidos da lista e dos subtotais, mas afetam o saldo. Sem explicação, o usuário pode não conseguir reconciliar os valores visíveis.

## 6. Desempenho e manutenção

A FlatList usa virtualização, lotes pequenos e carregamento incremental: são escolhas positivas. Isso limita a renderização de linhas, mas não os cálculos sobre o histórico.

- A tela filtra todo o histórico mais de uma vez, ordena o resultado e percorre os lançamentos novamente para cada conta, projeto e meta.
- As contas são recalculadas em renderSection, duplicando trabalho do store. O custo tende a crescer com número de contas × número de lançamentos.
- Contas e etiquetas são procuradas com find para cada linha renderizada; índices por ID ajudariam com volumes maiores.
- As referências de swipe são adicionadas ao Map, mas não removidas quando a linha desmonta, deixando referências antigas enquanto a tela permanecer montada.
- Há estados, handlers, imports e estilos sem uso, com supressões de lint. Eles aumentam o ruído da manutenção.
- Não há números de latência ou memória medidos; esses são riscos de crescimento, não prova de lentidão atual.

## 7. Prioridade proposta

1. Unificar datas e cálculo de saldos; corrigir a projeção acumulada e faturas.
2. Exibir status dos lançamentos e distinguir transferências.
3. Tornar explícitos os recortes: realizado, previsto, mês selecionado e acumulado.
4. Corrigir previsão das metas e atualização na virada do dia/retorno ao app.
5. Melhorar filtros, estados vazios, atalhos e acessibilidade.
6. Medir desempenho com históricos maiores e consolidar cálculos repetidos.

## 8. Critérios para uma próxima rodada de correções

- No mesmo instante, saldo principal e soma das contas devem usar a mesma regra de data.
- Projeção de dezembro deve carregar movimentos remanescentes de outubro e novembro, além de dezembro.
- Faturas previstas devem entrar uma única vez, no vencimento correto.
- Pago, pendente e vencido devem ser distinguíveis sem abrir cada lançamento.
- Transferência filtrada pela conta destinatária deve comunicar entrada.
- Período e alcance dos filtros devem ser visíveis e previsíveis.
- Meta com aporte zero deve ter estado compreensível; previsão a partir do dia 31 não deve pular mês indevidamente.
- Testes em dispositivo devem cobrir tema escuro, fonte ampliada, valores longos, retorno do segundo plano e rolagem com muitos lançamentos.
