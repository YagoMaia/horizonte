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

export function generateDailyProjection(
  transactions: any[],
  accounts: any[],
  daysAhead = 30,
) {
  const today = new Date();
  const totalBalance = accounts.reduce(
    (sum: number, a: any) => sum + a.balance,
    0,
  );
  const days = [];

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayTxs = transactions.filter((t) => {
      const txDate = new Date(t.date).toISOString().split('T')[0];
      return txDate === dateStr;
    });

    const income = dayTxs
      .filter((t: any) => t.type === 'receita')
      .reduce((s: number, t: any) => s + t.amount, 0);
    const expense = dayTxs
      .filter((t: any) => t.type === 'despesa')
      .reduce((s: number, t: any) => s + t.amount, 0);

    days.push({
      date: dateStr,
      balance: totalBalance + income - expense,
      income,
      expense,
      transactions: dayTxs,
    });
  }

  return days;
}

// lib/utils.ts

// 👉 NOVA FUNÇÃO: Descobre qual o Mês (0-11) e Ano da fatura atual
export function getCreditCardTargetMonth(
  account: any,
  baseDate: Date = new Date(),
) {
  const closingDay = account.closingDay || 31;
  let targetMonth = baseDate.getMonth(); // 0 a 11
  let targetYear = baseDate.getFullYear();

  // Se a data já passou do fechamento, a fatura é a do próximo mês
  if (baseDate.getDate() >= closingDay) {
    targetMonth += 1;
  }

  // Ajuste de virada de ano (Se for dezembro (11) + 1 = 12 -> Vira Janeiro (0))
  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear += 1;
  }

  return { targetMonth, targetYear };
}

// Usa a nova função para garantir alinhamento absoluto
export function calculateCreditCardInvoice(
  account: any,
  transactions: any[],
  baseDate: Date = new Date(),
): number {
  if (account.type !== 'cartao_credito') return 0;

  const { targetMonth, targetYear } = getCreditCardTargetMonth(
    account,
    baseDate,
  );

  return transactions
    .filter((tx) => {
      if (
        tx.accountId !== account.id ||
        tx.paymentMethod !== 'credito' ||
        tx.paid
      ) {
        return false;
      }

      const txDate = new Date(tx.date);
      return (
        txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear
      );
    })
    .reduce(
      (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
      0,
    );
}
