# Correções da tela Totais

Data: 18 de outubro de 2026

## Resultado

A tela Totais passou a usar uma única base financeira para os cartões de resumo e os gráficos. Os valores agora respeitam a data financeira local, não duplicam compras de cartão ao registrar o pagamento da fatura e permitem escolher de forma clara entre incluir ou ocultar lançamentos previstos.

## Mudanças realizadas

- Criado `lib/totals.ts`, que concentra a filtragem por período, o cálculo de resultados e a média diária.
- Datas no formato `AAAA-MM-DD` são tratadas com `financialDate`, preservando o dia correto no horário do Brasil.
- A visão Total adota competência: compras entram na data da compra; registros técnicos de pagamento ou antecipação de fatura ficam fora dos gastos para não haver duplicidade.
- Resumo, gráfico por categoria e gráfico de evolução recebem a mesma base de dados.
- Quando pendências estão ocultas, somente lançamentos pagos até a data atual são considerados.
- A média da semana atual usa somente os dias já transcorridos.
- A tela exibe e permite alternar a inclusão de lançamentos previstos. A preferência é salva no aplicativo.
- A ocultação de valores passou a ser compartilhada com Saldos, Cartões e Horizonte, inclusive nos gráficos e detalhes por categoria.
- Controles de período, gráficos e modal receberam áreas de toque maiores e rótulos de acessibilidade.
- Mês e ano podem ser escolhidos diretamente pelo título do período, sem navegar período a período.
- O gráfico de barras usa a data financeira correta e limpa a seleção ao mudar os dados ou o período.

## Testes adicionados

`__tests__/totals.test.tsx` cobre:

- datas sem horário em mês e semana;
- compra e pagamento de fatura no mesmo período;
- consistência entre resumo e conjunto exibido nos gráficos;
- lançamento pago com data futura;
- média da semana em andamento;
- privacidade, controle de pendências e escolha direta de mês na interface.

## Validação

- TypeScript sem erros.
- 14 suítes e 87 testes aprovados.
- Backup privado usado somente no ambiente local de testes, sem ser copiado ou incluído no repositório.
- Verificação de formatação do diff aprovada.

## Limitações

Não houve execução em um S23 físico, geração de APK ou medição de FPS nativo. A estrutura e os controles foram ajustados para áreas mínimas de toque e para se adaptarem a diferentes larguras.
