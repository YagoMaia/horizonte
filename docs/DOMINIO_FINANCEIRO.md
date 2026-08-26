# Manual de Regras de Negócio e Domínio Financeiro — Horizonte

Este documento detalha os algoritmos, regras contábeis, fórmulas de projeção e comportamentos esperados em cada módulo do **Horizonte**.

---

## 1. O Conceito "Horizonte" (Projeção de Fluxo de Caixa Diário)

A missão central do Horizonte é permitir que o usuário enxergue o impacto futuro de suas decisões financeiras diárias, respondendo à pergunta: *"Se eu mantiver meus hábitos e compromissos, com quanto dinheiro chegarei no fim do mês?"*

### 1.1 Seleção de Contas e Metas Ativas
Nem todo dinheiro acumulado deve fazer parte da liquidez de curto prazo:
- **Contas Ativas (`activeAccountIds`)**: Normalmente contas correntes e vales onde o salário entra e as despesas do dia a dia são debitadas. Contas de investimento de longo prazo são intencionalmente desmarcadas do Horizonte.
- **Metas Ativas (`activeGoalIds`)**: Metas com propósito de reserva de liquidez (ex: *Reserva de Emergência*) podem ser marcadas para somar ao saldo do Horizonte. Metas para compras futuras ou investimentos longos ficam de fora.

### 1.2 Algoritmo do Saldo Inicial (`openingBalance`)
Para calcular o saldo no primeiro dia do mês visualizado:
$$\text{activeBalance} = \sum_{\text{acc} \in \text{activeAccounts}} \text{acc.balance} + \sum_{\text{goal} \in \text{activeGoals}} \text{goal.accumulatedAmount}$$

Se o usuário estiver navegando em um mês futuro ou retroativo:
$$\text{openingBalance} = \text{activeBalance} - \text{txsToUndo}$$
Onde $\text{txsToUndo}$ desfaz receitas e despesas pagas entre o início do mês em foco e o momento presente. Transferências internas entre contas/metas ativas são tratadas como **neutras** e não afetam o saldo de abertura.

### 1.3 Simulação Diária (Motor de 30 Dias)
Para cada dia $d$ do mês:
$$\text{Saldo}_d = \text{Saldo}_{d-1} + \text{Receitas}_d - \text{DespesasDébito}_d - \text{FaturasCartão}_d - \text{TransferênciasSaída}_d - \text{GastoPlanejadoDiário}$$

- **Receitas**: Inclui receitas pagas/previstas do dia (excluindo resgates de metas ativas, cujo saldo já compõe a base).
- **Transferências de Saída**: Transferências para contas não participantes do Horizonte (ex: aporte em conta de investimento de longo prazo) reduzem a liquidez projetada.
- **Faturas de Cartão de Crédito**: Calculadas a partir da soma dos gastos no crédito daquele ciclo, cobradas pontualmente no dia do vencimento (`dueDay`).
- **Gasto Planejado Diário**: Valor diário alocado a partir do orçamento definido pelo usuário no modal de configurações.

---

## 2. Ciclo Contábil do Cartão de Crédito

O cartão de crédito opera em um modelo de duas etapas para garantir que o fluxo de caixa reflita a realidade:

```
[Compra no Crédito] ───> Não abate a Conta Bancária
                         Participa da Fatura do Mês (baseado no closingDay)
                         
[Fechamento da Fatura] ─> Consolida os débitos do período
                         
[Pagamento da Fatura] ──> Abate a Conta Bancária de Origem
                         Gera transação "Pagamento Fatura - [Nome]"
                         (Marcada para não duplicar no extrato analítico)
```

### Regras de Vencimento e Fechamento:
1. Se a compra ocorreu antes do dia `closingDay`, pertence à fatura do mês atual.
2. Se a compra ocorreu no dia ou após o `closingDay`, é postergada para a fatura do mês seguinte.
3. Se o vencimento `dueDay` for menor que o `closingDay` (ex: fecha dia 28 e vence dia 5 do mês seguinte), a transação é alocada para o mês subsequente.

---

## 3. Gestão de Metas de Economia (Cofrinho)

### 3.1 Tipos de Movimentação em Metas
1. **Aporte Manual**: Transferência da Conta $\rightarrow$ Meta (`goal_<id>`).
2. **Aporte Recorrente Automático**: Agendamento mensal (`GoalRecurrence`) verificado na inicialização do aplicativo (`processOverdueRecurrences`).
3. **Resgate**: Transferência da Meta (`goal_<id>`) $\rightarrow$ Conta bancária.

### 3.2 Sincronização Transacional Bidirecional (`syncWithTransactions`)
Toda mutação no cofrinho está ancorada em uma transação do `StoreContext`. Isso impede inconsistências:
- Aportes recebem o ID `tx_<transacaoId>`.
- Resgates recebem o ID `tx_withdraw_<transacaoId>`.
- Ao excluir um registro na tela de detalhes da meta, a transação original no extrato é deletada deterministicamente.

### 3.3 Ordenação e Visualização de Metas
Na `GoalsScreen`, as metas são priorizadas de acordo com a urgência:
1. **Em andamento com prazo definido**: Ordenadas pelo prazo mais próximo (com tags visuais de dias restantes ou aviso de atraso).
2. **Em andamento sem prazo definido**: Ordenadas pela data de criação mais recente.
3. **Metas Concluídas**: Enviadas para o final da listagem.

---

## 4. Orçamento Mensal por Categoria

O módulo `OrcamentoScreen` gerencia o planejamento por envelopes de gastos:
- O usuário define limites financeiros mensais para cada categoria (Alimentação, Moradia, Transporte, Lazer, etc.).
- Compras no débito e no crédito da respectiva categoria são somadas no mês.
- A barra de progresso indica visualmente se a categoria está dentro do limite ou em sobregasto (vermelho).

---

## 5. Extrato e Conciliação Financeira (`SaldosScreen`)

### 5.1 Prevenção de Dupla Contagem (Anti-Bitributação)
Ao exibir o resumo do mês no topo da tela:
- **Entradas**: Soma das receitas pagas do mês.
- **Saídas**: Soma de `Despesas no Débito (Pagas)` + `Compras no Crédito do Mês`.
- A transação gerada pelo *Pagamento de Fatura* é expressamente **desconsiderada** no somatório de saídas do painel superior, uma vez que as compras individuais já foram somadas no crédito.

### 5.2 Alertas de Lançamentos Atrasados
Transações passadas cujo campo `paid` permaneça como `false` disparam um banner de alerta no extrato, informando os itens específicos pendentes para rápida conciliação.

### 5.3 Rastreabilidade de Ajustes de Saldo
Ao alterar o saldo de uma conta bancária manualmente na `ContasScreen`, o sistema calcula a diferença e gera uma transação de **"Ajuste de Saldo"** (receita ou despesa) para que o extrato e o fluxo contábil permaneçam auditáveis.
