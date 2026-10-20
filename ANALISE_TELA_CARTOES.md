# Análise detalhada da tela Cartões

> Diagnóstico histórico anterior às correções. Implementação e validação concluídas em 18/10/2026: [CORRECOES_CARTOES.md](CORRECOES_CARTOES.md).

Data: 17/10/2026. Diagnóstico do código atual, após os ajustes de Saldos e responsividade. Nenhuma correção funcional foi aplicada nesta análise.

## Parecer

A tela permite consultar compras, navegar entre ciclos, registrar pagamento total e antecipar valores. Há problemas confirmados de classificação de vencimento, consolidação de períodos e aproveitamento de antecipações. Antes de ajustes estéticos, essas regras precisam ser unificadas com o motor financeiro de Saldos.

## Evidências e limites

- Leitura de CartaoScreen, TransactionItem, useStore, utils, financialIndex e navegação principal.
- Oito cenários diagnósticos executados com componentes reais e armazenamento simulado: todos reproduziram os comportamentos documentados. Passar nesses testes significa confirmar o diagnóstico, não corrigir os problemas.
- Backup local: 2 cartões e 258 lançamentos no crédito. Os dois cartões usam o mesmo par de dias de fechamento/vencimento; o caso de ciclos diferentes foi testado com dados sintéticos.
- Com data fixada em 17/10/2026, há 35 itens nas faturas abertas do backup; 34 têm combinação de data/status que produz “Vencido” na lista embora o vencimento da fatura ainda esteja no futuro.
- Não houve escrita no backup, operação bancária, instalação no S23 nem inspeção visual da tela Cartões nesta etapa. As observações de layout abaixo são riscos identificados no código; os testes de componentes não medem posicionamento nativo.
- Não foi medido tempo de renderização ou FPS de Cartões. As observações de desempenho descrevem o trabalho realizado pelo código.

## 1. Como a tela funciona

| Elemento | Comportamento atual |
|---|---|
| Seleção inicial | “Todos”, ou o cartão recebido pelo atalho de Saldos |
| Período | Ciclo que receberia uma compra feita hoje, deslocado pelas setas |
| Todos | Escolhe um ciclo por cartão, soma os valores e usa o mês do primeiro cartão no título |
| Valor em destaque | Total líquido dos itens da fatura, incluindo itens já pagos e créditos |
| Pagamento | Pode gerar despesa na conta de origem ou apenas marcar os itens como pagos |
| Antecipação | Cria despesa na origem e uma receita no crédito, na fatura selecionada |
| Lista | Itens da fatura em ordem de data, com componente compartilhado de lançamento |
| Exclusão | Exclui itens e expande para famílias, inclusive parcelas de outros meses |

Pontos positivos: lista virtualizada, distinção entre pagar com débito e marcar pago, aviso do alcance da exclusão, seletor de cartões horizontal e reaproveitamento do componente de lançamento já adaptado para telas estreitas.

## 2. Erros confirmados

### 2.1 Alta — status do lançamento usa a data da compra como vencimento

Referências: `components/screens/CartaoScreen.tsx:370`; `components/TransactionItem.tsx:70`.

Cartões não fornece o status financeiro ao TransactionItem. O componente considera vencida qualquer compra não paga com data anterior a hoje, mesmo quando sua fatura só vence no próximo mês. No teste, a tela mostra “FATURA EM ABERTO” e “Vencido” no item da mesma fatura.

Impacto observado na base real: 34 dos 35 itens dos ciclos abertos entram nessa classificação em 17/10/2026. Não significa que o usuário tem 34 pagamentos atrasados. Saldos já usa o vencimento da fatura para esses itens, criando divergência entre telas.

Correção indicada: consumir o status do índice financeiro e distinguir data da compra de vencimento da obrigação.

### 2.2 Alta — antecipação acima do valor da fatura perde o crédito excedente na projeção

Referências: `components/screens/CartaoScreen.tsx:333`; `hooks/useStore.ts:1008`; `lib/financialIndex.ts:91`.

A interface permite antecipar até a dívida total do cartão, mas o store lança todo o crédito apenas na fatura selecionada. O índice financeiro zera faturas negativas individualmente, sem transportar o crédito para as seguintes.

Cenário sintético reproduzido:

- Saldo da conta: R$ 1.000.
- Fatura de novembro: R$ 100; dezembro: R$ 200.
- Antecipação de R$ 150 aplicada a novembro.
- Saldo bancário após antecipar: R$ 850.
- Novembro fica com crédito líquido de R$ 50, mas dezembro continua cobrando R$ 200 na projeção.
- Projeção exibida até dezembro: R$ 650. Com aproveitamento do crédito excedente, seria R$ 700.

Não há desaparecimento do registro de crédito; há falha na sua compensação entre ciclos. A correção precisa atingir o modelo de antecipação e a projeção, não apenas o texto da tela. Alternativas: limitar a antecipação à fatura escolhida ou implementar um saldo credor do cartão com compensação explícita.

### 2.3 Alta — “Todos” pode misturar meses sob um único título

Referências: `components/screens/CartaoScreen.tsx:125` e `:160`.

Cada cartão escolhe seu próprio ciclo aberto; o título usa somente o primeiro. No teste, um cartão contribui com novembro e outro com outubro; a tela apresenta a soma como “Novembro 2026”. Isso não ocorre com os ciclos iguais do backup fornecido, mas foi confirmado com dois ciclos válidos diferentes.

Correção indicada: escolher uma competência de vencimento comum ou rotular o agregado como “Faturas abertas”, identificando o mês e vencimento de cada cartão. Compensar crédito de um cartão com dívida de outro também deve ser evitado na classificação global de pagamento.

### 2.4 Média — as setas podem pular um mês

Referência: `components/screens/CartaoScreen.tsx:114`.

A navegação aplica setMonth mantendo o dia atual. No teste com 31/01/2026, fechamento dia 1 e vencimento dia 10, a tela sai de fevereiro diretamente para abril. Fevereiro não tem dia 31, então a data-base transborda para março antes de calcular a fatura.

Correção indicada: navegar diretamente por ano/mês da fatura, ancorando o calendário no primeiro dia.

### 2.5 Média — vencimento 31 transborda em mês curto

Referência: `components/screens/CartaoScreen.tsx:200`.

O cadastro aceita dia 31. A tela cria `new Date(ano, mês, 31)` sem limitar ao último dia válido. No teste de 01/03/2026, a fatura de fevereiro com dia 31 ainda aparece aberta, pois a data calculada é 03/03. Saldos já limita esse dia ao fim do mês, gerando outra divergência entre telas.

Correção indicada: centralizar a data efetiva de vencimento e a política para meses curtos. O tratamento de feriados/dias úteis não está modelado; não foi presumido no teste.

### 2.6 Média — leitura do valor antecipado aceita números parciais

Referência: `components/screens/CartaoScreen.tsx:326`.

O texto é convertido com parseFloat após trocar uma vírgula por ponto. `1.234,56` é lido como `1.234`, não como `1234.56`; texto parcialmente numérico também pode ser aceito. A entrada via teclado decimal não impede colagem.

Correção indicada: conversão monetária explícita, validação integral e cálculo em centavos. A lógica de pagamentos também soma números decimais diretamente, ao contrário do índice de Saldos.

### 2.7 Baixa — fatura vazia aparece como paga no botão

Referência: `components/screens/CartaoScreen.tsx:429`.

Sem lançamentos, o cartão mostra “FATURA ZERADA”, mas o botão desabilitado mostra “Paga”. Reproduzido em componente real. Saldo zero não comprova pagamento; também pode representar créditos compensando despesas.

## 3. Pagamento e antecipação: riscos identificados no código

- **Marcar como paga não é somente visual.** O texto do modal web afirma isso, mas alterar paid retira a dívida das projeções e do total pendente. A opção é válida para pagamentos registrados fora do aplicativo; precisa explicar o efeito e que não debita uma conta.
- **Antecipação aceita data futura.** A despesa só passa ao saldo realizado na data escolhida, mas o crédito é inserido imediatamente na fatura selecionada. A mensagem “limite liberado” pode anteceder a realização. É preciso separar agendamento de pagamento realizado.
- **Crédito tem data artificial.** O lançamento “Pagamento Antecipado” recebe o primeiro dia de um mês calculado para entrar na fatura, não a data de pagamento escolhida. A tela mistura competência e data da operação, sem vínculo explícito entre os dois registros.
- **Falta proteção de operação em andamento.** Não há estado ocupado nem bloqueio do botão enquanto salva. O store usa listas capturadas por closures e não serializa essas mutações; há risco de concorrência e sobrescrita em toques rápidos. Não foi reproduzida perda de dados nesta análise.
- **Persistência em duas etapas.** Grava lançamentos e depois contas. Falha na segunda escrita pode mostrar erro depois de o pagamento já ter sido registrado. Falta transação/recuperação específica para essa operação.
- **Pagamento total usa sempre a data atual.** Não permite informar a data real de um pagamento passado, embora a antecipação permita escolher data.
- **Não existe vínculo de pagamento com fatura.** A despesa bancária não guarda identificador do ciclo/cartão pago. A reconciliação, reversão e edição posterior dependem da descrição.
- **Exclusão expande famílias por heurística de ID.** Além de groupId, qualquer hífen é interpretado como família (`useStore.ts:1073`). Isso pode agrupar IDs externos indevidamente. O aviso menciona parcelas, mas a implementação também pode alcançar recorrências e pares de antecipação. Não foram excluídos dados reais.

## 4. Clareza e navegação

- O valor em destaque é o total da fatura; o restante a pagar só aparece ao abrir o modal. Após pagamento parcial, falta apresentar “total”, “pago/antecipado” e “restante”.
- Não mostra datas de fechamento e vencimento junto ao valor. O status não distingue explicitamente “fechada, aguardando vencimento” de “aberta para novas compras”.
- O ciclo inicial é o de uma compra feita hoje, não necessariamente a fatura que vence agora. Pendências de ciclos anteriores podem exigir busca manual pelas setas.
- Não há atalho para o ciclo atual nem seletor direto de competência.
- Mudar de cartão zera o deslocamento mensal. Sair e voltar à aba perde seleção/período; o cartão inicial pode retornar ao último atalho vindo de Saldos, não à última seleção da própria tela.
- Não há busca, filtro por situação ou privacidade local equivalente à de Saldos.
- Limite cadastrado, disponível e comprometido não aparecem no JSX atual, embora existam estilos com esses nomes. A mensagem de “limite liberado” não possui indicador verificável na tela nem confirmação de uma instituição financeira.
- Sem cartões, há apenas mensagem; falta ação direta para cadastrar.

## 5. Celular, acessibilidade e S23

Os seguintes pontos precisam de validação visual e funcional Android:

- Modal de pagamento total não tem altura máxima nem área rolável para a lista de contas. Com várias contas, tela baixa ou fonte grande, os botões podem ficar inacessíveis.
- Modais não têm onRequestClose para o botão Voltar do Android.
- Margens inferiores são fixas; não usam as áreas seguras como Saldos.
- Antecipação tem rolagem, mas não há tratamento explícito de teclado cobrindo controles; o calendário usa textos de 9–12 pontos e alvos pequenos.
- Nome do cartão, mês e linha de ações não têm estratégia consistente de quebra. Dois botões lado a lado e valor de 36 pontos merecem teste em 320/360 pixels e fonte ampliada.
- Texto branco é usado sobre qualquer cor cadastrada de cartão; cores claras podem reduzir o contraste.
- Setas e seletores não têm rótulos/estado acessível explícitos como os adicionados em Saldos. A ocultação de valores não é compartilhada entre abas.

O TransactionItem já incorpora os ajustes móveis anteriores; isso melhora as linhas, mas não resolve os demais elementos da tela Cartões.

## 6. Desempenho e manutenção

A lista é virtualizada, o que reduz a quantidade de componentes montados. Porém, o cálculo anterior à renderização ainda percorre o histórico repetidamente:

- Na visão Todos, cada cartão filtra o histórico para a fatura e novamente para a dívida total: custo proporcional a cartões × lançamentos, seguido de ordenação.
- Para um cartão, a lista inteira também é filtrada mais de uma vez.
- Cada item da visão Todos procura sua conta com find.
- Trocar mês refaz trabalho que pode ser consultado por cartão e competência em um índice compartilhado.
- A tela não consome explicitamente o relógio diário do store. Atualizações indiretas das contas hoje podem provocar recálculo, mas a dependência temporal está implícita.
- O contexto é convertido para any, reduzindo a capacidade do TypeScript de detectar divergências de contrato.

Com os 638 lançamentos do backup, não há evidência suficiente para atribuir lentidão perceptível exclusivamente a esta tela. Recomenda-se medir no S23 após corrigir as regras, reaproveitando os índices financeiros em vez de criar outro cálculo paralelo.

## 7. Ordem recomendada de correção

1. Unificar status e vencimentos; corrigir o crédito excedente das antecipações e sua data de realização.
2. Definir competência comum para Todos e navegação por mês sem transbordamento.
3. Validar valores em centavos; proteger gravações concorrentes e ligar pagamentos à fatura.
4. Mostrar total, pago, restante, fechamento e vencimento; explicar corretamente “marcar como paga”.
5. Tornar modais utilizáveis com teclado/fonte ampliada e Voltar do Android; preservar navegação e privacidade.
6. Indexar consultas e medir a tela com a base real no dispositivo.

Os testes diagnósticos temporários foram removidos após execução para não incorporar as falhas atuais como comportamento desejado na suíte de regressão. Este documento registra os cenários para transformá-los em testes de correção na implementação.
