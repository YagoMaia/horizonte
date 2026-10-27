# Correções de Saldos e desempenho

Concluído em 17/10/2026. Este registro substitui o estado dos problemas descritos na análise anterior, preservada como diagnóstico histórico.

## Correções implementadas

- Motor financeiro compartilhado: saldo das contas e total usam a mesma data local e valores em centavos. Datas sem horário preservam o dia informado, inclusive na edição.
- Projeção acumulada: inclui pendências dos meses intermediários e faturas no vencimento; pagamentos feitos pelo fluxo de fatura não são contados duas vezes. O passado mostra saldo realizado de fechamento.
- Resumo separa receitas/despesas realizadas e previstas, ajustes e projeção. Contas, projetos e metas indicam seu recorte temporal.
- Lançamentos mostram situação, mesmo sem ícone da categoria. Confirmação direta de pagamento/recebimento registra a data atual após confirmação. Transferências indicam origem/destino e sinal conforme a conta filtrada.
- Filtros por situação, tipo e conta; busca sem distinguir acentos; seleção só passa a valer ao aplicar. Estados vazios distinguem mês vazio de filtro sem resultado.
- Seletor de mês independente da visibilidade da lista, atalho ao mês atual e preservação de mês, filtros, paginação, privacidade e posição durante a navegação entre abas da sessão.
- Cards de contas, cartões e metas oferecem atalhos. Projetos distinguem realizado, previsto e orçamento restante; detalhes respeitam a ocultação dos valores.
- Metas sem aporte mostram “Sem previsão”; previsão mensal não pula novembro ao partir de 31 de outubro.
- Atualização na virada do dia e ao retornar do segundo plano, com limpeza de temporizador e listener.
- Agrupamento dos lançamentos por dia, contador, carregamento explícito em lotes e indicação de fim. Rótulos acessíveis, áreas de toque e quebra de valores/textos melhorados.

## Redução de trabalho repetido

O histórico é agregado e indexado quando dados ou dia mudam. A tela consulta mapas de contas, projetos, metas e meses, evitando percorrer todo o histórico para cada card ou troca de período. Formatação monetária reutiliza o formatador; referências das linhas são liberadas ao desmontar; blocos do resumo são independentes da digitação da busca.

Ensaio sintético local com 50.000 lançamentos, 40 contas, 40 projetos e 40 metas; mediana de sete execuções após aquecimento:

| Operação | Referência anterior | Implementação atual |
|---|---:|---:|
| Preparação dos dados | 249,03 ms | 155,59 ms |
| Seleção do mês | 21,76 ms | 0,072 ms |
| Formatação de 1.000 valores | 44,93 ms | 0,746 ms |

Reprodução: `node scripts/benchmark-saldos.cjs`. Dados brutos em `.agent-memory/benchmark-saldos.json`. A referência reproduz as varreduras anteriores, não o aplicativo inteiro. Esses números medem processamento em Node, não FPS, abertura do aplicativo ou desempenho em aparelho.

## Validação

- 45 testes aprovados em sete suítes, incluindo 19 novos cenários de cálculo, tela e atualização diária.
- TypeScript sem erros; `git diff --check` sem erros de whitespace.
- Aplicativo web recompilado e aberto: navegação de mês, aplicação de filtro e preservação ao trocar de aba conferidas. Inspeção visual do resumo com base vazia isolada; captura em `.agent-memory/saldos-validacao.png`.
- Cálculos com dados preenchidos e ações financeiras validados por testes automatizados; não houve operação com dinheiro real.
- ESLint não executado porque a dependência não está instalada neste ambiente.
- Ainda não foi feita medição nativa em Android/iOS nem inspeção em dispositivo pequeno. Não se afirma que toda causa de lentidão do aplicativo foi eliminada; os gargalos identificados em Saldos foram tratados.

## Simplificação do resumo — 27/10/2026

- Seletor de mês com fundo na cor principal do tema e controles contrastantes.
- Atalho Mês atual substituído por ícone de calendário com descrição para acessibilidade.
- Resumo contém saldo realizado hoje, receitas realizadas e todas as despesas. O saldo é atual; receitas e despesas correspondem ao mês selecionado.
- Despesas somam valores realizados e pendentes, incluindo faturas no vencimento e evitando duplicar compras de cartão com pagamentos.
- Removidos detalhes de projeções, receitas previstas e ajustes do cartão de resumo.
- Verificações: TypeScript, git diff --check e 16 testes da tela de Saldos aprovados; não houve validação física no S23 nesta etapa.
