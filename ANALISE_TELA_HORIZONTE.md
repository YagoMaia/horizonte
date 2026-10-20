# Análise detalhada da tela Horizonte

> Diagnóstico histórico anterior às correções. Implementação e validação concluídas em 18/10/2026: [CORRECOES_HORIZONTE.md](CORRECOES_HORIZONTE.md).

Data: 18/10/2026. Diagnóstico do código atual. Esta análise não altera regras funcionais nem dados do usuário.

## Parecer

A tela Horizonte tem uma proposta útil: transforma saldo atual, lançamentos, orçamento e faturas em uma linha diária de caixa. O principal risco está no motor de projeção, que foi implementado dentro da própria tela e tem regras diferentes do índice financeiro usado por Saldos e Cartões. Isso pode antecipar ou omitir faturas de cartão e tornar a projeção menos confiável quando o usuário altera contas ou mantém a tela aberta por muito tempo.

## Como a tela funciona

1. A pessoa seleciona um mês, contas bancárias e uma meta mensal.
2. O componente parte do saldo atual das contas selecionadas e retrocede lançamentos já realizados para reconstituir o início do período.
3. Ele percorre cada dia, desloca pendências vencidas para hoje, aplica receitas, saídas, transferências e ajustes.
4. O orçamento restante é distribuído pelos dias restantes. Despesas variáveis realizadas reduzem a meta diária dos dias seguintes.
5. Para os próximos meses, o componente cria uma despesa virtual para cada fatura de cartão pendente.
6. O resultado é mostrado em lista diária ou grade de três meses; um toque abre os lançamentos daquele dia.

## Achados confirmados

| Prioridade | Achado | Evidência e efeito |
|---|---|---|
| Alta | Fatura é lançada no dia 1, não no vencimento | A injeção virtual usa `effKey = ano-mês-1` em `HorizonteScreen.tsx:286`. Uma fatura com vencimento no dia 5, por exemplo, derruba a projeção quatro dias antes. O saldo do fim do mês pode coincidir, mas os alertas diários e a decisão de gasto não. |
| Alta | Fatura que vence no mês atual pode ficar fora da projeção | A injeção só roda para mês estritamente futuro (`:279`). Compras no crédito são removidas do cálculo de caixa; portanto, se houver uma fatura pendente com vencimento posterior a hoje, ainda dentro do mês atual, ela não entra como despesa virtual. |
| Alta | O filtro de contas não controla o efeito das faturas | O código força todas as faturas de cartões, inclusive quando nenhuma conta está ativa para o planejamento (`:281-283`). Não há vínculo entre pagamento da fatura e uma conta de origem. Assim, desmarcar uma conta reduz o saldo inicial mas não restringe as saídas de cartão. |
| Média | Motor financeiro duplicado e divergente | A tela reimplementa saldo, transferências, atrasos, ajustes, orçamento e faturas entre `:201-469`, enquanto Saldos e Cartões usam `lib/financialIndex.ts`. Isso dificulta manter a mesma regra após mudanças e já exige exceções como lançamentos virtuais. |
| Média | Alterações em cartão podem não recalcular a projeção | `accounts` e `getInvoicePendingForMonth` são usados no cálculo, mas não constam nas dependências do `useMemo` (`:469`). Uma edição do cartão que não altere o saldo em dinheiro pode manter a projeção anterior até outra atualização provocar novo cálculo. |
| Média | Dia atual fica congelado enquanto a tela permanece aberta | `today` é criado uma única vez (`:90`). Após a virada de data, status, rolagem automática, pendências vencidas e projeção continuam usando o dia anterior até desmontar a tela. |
| Média | Orçamento aceita valores incorretos em formato brasileiro e negativos | `parseFloat(budgetInput.replace(',', '.'))` (`:168`) interpreta `1.234,56` como `1.234` e aceita valores negativos. A meta salva pode ficar muito menor que a digitada ou deixar de gerar planejamento sem explicação. |
| Média | Preferência de contas pode piscar ou ser regravada fora de ordem | A leitura assíncrona de `@horizonte:active_accounts` ocorre toda vez que `accounts` muda (`:131-146`). Como `accounts` é recalculado quando os lançamentos mudam, uma leitura antiga pode competir com um toque recente do usuário. IDs de contas removidas também permanecem na preferência até nova gravação. |
| Baixa | Privacidade não é compartilhada | Saldos e Cartões usam o estado único de ocultação no `app/index.tsx:33`, mas Horizonte é instanciado sem essas propriedades (`:78`). Valores e projeções continuam expostos nesta tela após a pessoa ocultá-los nas outras. |
| Baixa | Interação e modais não cobrem bem o S23 em paisagem | Botões de navegação/configuração têm apenas 38 px aproximados (`:1299-1300`). O modal usa altura fixa de rolagem de 350 px (`:981`) e o teclado só recebe tratamento no iOS. Em Android horizontal, teclado e botão de salvar podem ficar inacessíveis. |

## Desempenho

A lista possui no máximo 31 linhas e a grade 93 células, portanto não é a principal fonte de lentidão. O custo relevante é o cálculo: para cada mês simulado, a tela filtra todos os lançamentos e depois passa por todos os dias; em seguida a grade busca cada dia por varredura (`:539`). Com o horizonte atual de até três meses isso é aceitável para poucos centenas de lançamentos, mas cresce com o histórico e executa novamente em cada mudança de estado.

O índice compartilhado já preparado em `lib/financialIndex.ts` reúne metadados e faturas em uma passagem. Extrair o motor de projeção para uma função pura que receba esse índice evitaria regras duplicadas, facilitaria testes e permitiria indexar lançamentos por data uma vez.

## Interface e acessibilidade

A lista diária é legível e possui linhas com altura adequada. A grade oferece comparação rápida entre meses, mas resume valores grandes como `1000K` em vez de `1M` e depende principalmente de cor para indicar risco. O modal diário não informa, antes do toque, quantas movimentações existem; lançamentos virtuais de fatura aparecem, porém não podem abrir detalhes do cartão.

O mês só pode ser percorrido um a um. Para planejamento anual ou correção de períodos antigos, falta uma seleção direta de competência como a já adotada em Cartões.

## Recomendações em ordem

1. Mover a projeção para `lib/` e definir uma única fonte de regras com o índice financeiro.
2. Criar faturas virtuais exatamente na data de vencimento, inclusive no mês atual quando o vencimento ainda não ocorreu. Definir claramente como a seleção de contas participa do pagamento.
3. Corrigir dependências, atualizar a referência de hoje diariamente e normalizar preferências de contas existentes.
4. Validar dinheiro brasileiro em centavos e rejeitar orçamento negativo.
5. Reaproveitar privacidade entre todas as telas financeiras; incluir seletor direto de mês, áreas de toque de pelo menos 44–48 px e modal adaptado à altura/teclado Android.
6. Adicionar testes unitários para o motor de projeção: vencimento atual/futuro, cartão pago/parcial, contas ativas, atraso, transferências e virada de mês.

## Verificações e limites

- Inspeção de `HorizonteScreen.tsx`, `financialIndex.ts`, `useStore.ts`, `app/index.tsx` e testes existentes.
- TypeScript aprovado sem erros.
- Jest aprovado: 10 suítes e 70 testes ativos. Uma suíte com quatro testes privados de backup foi ignorada nesta rodada porque `HORIZONTE_TEST_BACKUP` não foi definido.
- Não há teste específico da tela Horizonte no repositório atualmente.
- O ESLint não pôde ser executado: o pacote não existe em `node_modules`, embora esteja listado em `package.json`.
- Não houve execução em S23, medição de FPS, alteração de dados, APK ou operação bancária.
