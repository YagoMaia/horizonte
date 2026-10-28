# Correções — criação de lançamentos

Data: 28/10/2026.

## Parcelas e faturas

- A primeira competência vem do cálculo central de faturas, que ajusta o fechamento ao último dia do mês.
- As parcelas seguintes recebem competências explícitas e consecutivas. Fechamento no dia 1 não pula meses; fechamento 31 em fevereiro não acumula duas parcelas na mesma fatura.
- A data original da compra é preservada em `purchaseDate`; as datas das ocorrências continuam mensais e `invoiceMonth` determina o vencimento.
- A edição de uma família conserva as competências quando a data/conta não mudam; mudanças de data recalculam a sequência, sem reaplicar fechamento às datas artificiais.
- Não foi realizada migração automática dos parcelamentos históricos. Os testes cobrem geração nova, edição e reabertura do armazenamento.

## Proteção de gravações

- As mutações financeiras de lançamentos, contas e pagamentos compartilham uma fila. Cada operação lê a última versão confirmada de contas e lançamentos.
- Exclusão de projetos/metas também usa a fila financeira ao remover vínculos dos lançamentos.
- Identificadores de lançamentos/famílias usam horário, sequência e aleatoriedade, evitando colisão no mesmo milissegundo.
- A fila se recupera após falhas; a gravação de lançamentos e saldos mantém o diário recuperável.
- O formulário bloqueia fechar, voltar pelo botão do Android e novos envios durante o salvamento.

## Recorrências

- Sem data final, o formulário exibe Quantidade de repetições, inicialmente 24 e editável. O texto informa que a primeira ocorrência está incluída e quantos lançamentos serão criados.
- A quantidade deve ser inteira, de 1 a 1000. Períodos maiores pedem redução do intervalo para evitar travamento por criação massiva.
- Com data final, o período determina a quantidade, respeitando o término.
- O quinto dia útil conta somente ocorrências válidas a partir do início, sem perder uma repetição quando o quinto dia do primeiro mês já passou.
- Dias úteis avançam em sequência, evitando percorrer novamente todos os dias anteriores para gerar cada ocorrência.
- Datas são validadas estritamente, rejeitando datas impossíveis em vez de convertê-las para outro dia.

## Uso móvel e acessibilidade

- Fechar/salvar, calendário, campos, tipo, contas, categorias, projetos, metas, parcelas, recorrências e interruptor possuem papéis/identificação acessíveis; seleções e desabilitação são expostas ao leitor de tela.
- Áreas de toque foram ampliadas nos controles; cabeçalho pode quebrar linha e rótulos longos podem encolher no espaço disponível sem limitar a escala da fonte.
- O formulário usa ajuste de teclado no Android e mantém margem inferior segura e rolagem.
- O teclado fecha ao abrir o calendário. Calendário tem altura limitada ao espaço disponível, conteúdo rolável e navegação rápida adaptável à altura da tela.

## Validação

- TypeScript: aprovado.
- Testes específicos: 27 aprovados, incluindo os cenários financeiros reproduzidos na análise e acessibilidade/teclado do formulário.
- Validação completa: 22 suítes / 146 testes aprovados. Quatro testes opt-in ficaram ignorados porque o backup privado não está mais disponível no caminho original.
- `git diff --check`: aprovado.
- ESLint não pôde executar porque seu pacote local não está instalado em `node_modules`.
- Sem teste físico no S23 nesta etapa; os ajustes de layout/teclado foram verificados pelo código e testes de componentes.
