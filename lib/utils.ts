import { Account, Transaction } from '@/constants/types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateString));
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export interface DailyBalance {
  date: string;
  balance: number;
  income: number;
  expense: number;
  transactions: Transaction[];
  isNegative?: boolean;
}

export function generateDailyProjection(
  transactions: Transaction[],
  accounts: Account[],
  daysAhead = 30,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Consideramos apenas contas que não são cartão de crédito para o "caixa" disponível
  let runningBalance = accounts
    .filter(a => a.type !== 'cartao_credito')
    .reduce((sum, a) => sum + a.balance, 0);

  const days: DailyBalance[] = [];
  let firstNegativeDate: string | null = null;

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Filtramos transações do dia que afetam o caixa (não ignoramos transferências aqui)
    const dayTxs = transactions.filter((t) => {
      const txDate = new Date(t.date).toISOString().split('T')[0];
      return txDate === dateStr && !t.paid; // Apenas as não pagas (futuras)
    });

    const income = dayTxs
      .filter((t) => t.type === 'receita')
      .reduce((s, t) => s + t.amount, 0);

    const expense = dayTxs
      .filter((t) => t.type === 'despesa')
      .reduce((s, t) => s + t.amount, 0);

    runningBalance += (income - expense);

    if (runningBalance < 0 && !firstNegativeDate) {
      firstNegativeDate = dateStr;
    }

    days.push({
      date: dateStr,
      balance: runningBalance,
      income,
      expense,
      transactions: dayTxs,
      isNegative: runningBalance < 0,
    });
  }

  return { days, firstNegativeDate };
}

// 👉 NOVA FUNÇÃO: Determina mês/ano da fatura de um lançamento específico baseado nas regras do cartão
export function getInvoiceForTx(dateStr: string, account: any) {
  const closingDay = account?.closingDay || 25;
  const dueDay = account?.dueDay || 5;
  const d = new Date(dateStr);

  let m = d.getMonth() + 1;
  let y = d.getFullYear();

  if (d.getDate() >= closingDay) m += 1;
  if (dueDay < closingDay) m += 1;

  while (m > 12) {
    m -= 12;
    y += 1;
  }
  // Retorna m-1 para ser compatível com o formato 0-11 do JavaScript
  return { viewMonth: m - 1, viewYear: y, value: y * 100 + m };
}

// Usa a nova função para garantir alinhamento absoluto com a CartaoScreen
export function calculateCreditCardInvoice(
  account: any,
  transactions: any[],
  baseDate: Date = new Date(),
): number {
  if (account.type !== 'cartao_credito') return 0;

  // 1. Descobre qual é a fatura que estaria "Aberta" hoje (ou na baseDate)
  const targetInvoice = getInvoiceForTx(baseDate.toISOString(), account);
  const tValue = targetInvoice.value;

  // 2. Soma todas as transações que pertencem a esse período de fatura
  return transactions
    .filter((tx) => {
      if (
        tx.accountId !== account.id ||
        tx.paymentMethod !== 'credito' ||
        tx.paid
      ) {
        return false;
      }

      // Calcula a fatura de cada transação individualmente
      const txInvoice = getInvoiceForTx(tx.date, account);
      return txInvoice.value === tValue;
    })
    .reduce(
      (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
      0,
    );
}

export function getTransactionVisuals(type: string, colors: any) {
  switch (type) {
    case 'receita':
      return {
        icon: 'arrow-up',
        color: colors.success,
        bgColor: colors.successLight || (colors.success + '15'),
        prefix: '+',
      };
    case 'transferencia':
      return {
        icon: 'swap-horizontal',
        color: colors.primary,
        bgColor: colors.primary + '15',
        prefix: '',
      };
    case 'despesa':
    default:
      return {
        icon: 'arrow-down',
        color: colors.destructive,
        bgColor: colors.dangerLight || (colors.destructive + '15'),
        prefix: '-',
      };
  }
}
