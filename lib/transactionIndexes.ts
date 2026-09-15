import { Transaction } from '@/constants/types'

export interface TransactionIndexes {
  byMonth: Map<string, Transaction[]>
  byMonthAndDay: Map<string, Map<number, Transaction[]>>
  byAccount: Map<string, Transaction[]>
  creditByCard: Map<string, Transaction[]>
  reportingTransactions: Transaction[]
  reportingByMonth: Map<string, Transaction[]>
}

const append = <K,>(map: Map<K, Transaction[]>, key: K, transaction: Transaction) => {
  const values = map.get(key)
  if (values) values.push(transaction)
  else map.set(key, [transaction])
}

export function buildTransactionIndexes(transactions: Transaction[]): TransactionIndexes {
  const byMonth = new Map<string, Transaction[]>()
  const byMonthAndDay = new Map<string, Map<number, Transaction[]>>()
  const byAccount = new Map<string, Transaction[]>()
  const creditByCard = new Map<string, Transaction[]>()
  const reportingTransactions: Transaction[] = []
  const reportingByMonth = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    append(byAccount, transaction.accountId, transaction)

    if (transaction.paymentMethod === 'credito') {
      append(creditByCard, transaction.accountId, transaction)
    }

    if (!transaction.date || transaction.date.length < 10) continue

    const month = transaction.date.substring(0, 7)
    const day = Number(transaction.date.substring(8, 10))
    append(byMonth, month, transaction)

    let days = byMonthAndDay.get(month)
    if (!days) {
      days = new Map<number, Transaction[]>()
      byMonthAndDay.set(month, days)
    }
    append(days, day, transaction)

    if (transaction.paid && transaction.type !== 'transferencia') {
      reportingTransactions.push(transaction)
      append(reportingByMonth, month, transaction)
    }
  }

  return {
    byMonth,
    byMonthAndDay,
    byAccount,
    creditByCard,
    reportingTransactions,
    reportingByMonth,
  }
}
