// lib/utils.ts
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateString))
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function generateDailyProjection(
  transactions: any[],
  accounts: any[],
  daysAhead = 30
) {
  const today = new Date()
  const totalBalance = accounts.reduce((sum: number, a: any) => sum + a.balance, 0)
  const days = []

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]

    const dayTxs = transactions.filter(t => {
      const txDate = new Date(t.date).toISOString().split('T')[0]
      return txDate === dateStr
    })

    const income = dayTxs.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + t.amount, 0)
    const expense = dayTxs.filter((t: any) => t.type === 'despesa').reduce((s: number, t: any) => s + t.amount, 0)

    days.push({ date: dateStr, balance: totalBalance + income - expense, income, expense, transactions: dayTxs })
  }

  return days
}
