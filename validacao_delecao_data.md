# Validação: Exclusão de Parcelas e Correção de Data

Analisei o código e encontrei exatamente os dois pontos que você mencionou. Abaixo está o detalhamento do que está acontecendo e como vou corrigir.

## 1. Exclusão de Compras Parceladas no Cartão
**O problema atual:** Na tela `CartaoScreen`, quando você clica em uma transação para abrir o menu de opções, o botão de exclusão diz **"Excluir Compra Inteira"**. A função associada a ele executa a exclusão com a tag `'all'`, o que significa que o aplicativo toma a decisão por você e apaga toda a família de parcelas.
- Ao contrário disso, na tela `SaldosScreen`, quando você desliza para apagar (swipe-to-delete), o aplicativo usa o componente `RecurrenceActionModal` que pergunta se você deseja apagar "Apenas este", "Deste em diante" ou "Todos".

**A solução:**
Vou importar o `RecurrenceActionModal` para dentro do `CartaoScreen`. Quando você clicar em "Excluir Compra", o app vai verificar se é uma compra parcelada/recorrente. Se for, ele abrirá o modal de opções (Única, Futuras, Todas) exatamente como na parte de edição.

## 2. Bug da Data ao Editar Transações
**O problema atual:** No `AddTransactionModal.tsx`, quando você clica em "Editar Lançamento", o sistema carrega corretamente as informações da transação (valor, conta, descrição, data). Porém, ao clicar na data para abrir o calendário, o calendário sempre abre mostrando o **mês atual**, em vez do mês original da transação. 
- Isso ocorre porque o estado `calendarMonth` é inicializado como `new Date()` e não é atualizado para a data da transação quando você entra no modo de edição.

**A solução:**
Vou adicionar uma linha no fluxo de inicialização da edição (`useEffect` do modal) para garantir que `setCalendarMonth(nova Data(transactionToEdit.date))` seja acionado. Assim, se você for editar uma compra de "Agosto de 2025", o calendário já vai abrir diretamente em Agosto de 2025.

---
Se o plano estiver de acordo com o que você espera, clique em "Proceed" ou me dê o "ok" e eu realizarei as modificações nos arquivos `CartaoScreen.tsx` e `AddTransactionModal.tsx`.
