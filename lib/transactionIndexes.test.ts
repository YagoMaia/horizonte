import { Transaction } from '@/constants/types'
import { buildTransactionIndexes } from './transactionIndexes'

const makeTransaction = (index: number): Transaction => ({
  id: String(index),
  description: `Lançamento ${index}`,
  amount: index + 1,
  type: index % 7 === 0 ? 'transferencia' : index % 2 === 0 ? 'receita' : 'despesa',
  date: `2026-${String((index % 5) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
  accountId: `account-${index % 4}`,
  recurrence: 'unica',
  paid: index % 3 !== 0,
  paymentMethod: index % 4 === 0 ? 'credito' : 'debito',
})

describe('buildTransactionIndexes', () => {
  it('indexes a representative five-month history in one pass', () => {
    const transactions = Array.from({ length: 500 }, (_, index) => makeTransaction(index))
    const startedAt = performance.now()
    const indexes = buildTransactionIndexes(transactions)
    const elapsed = performance.now() - startedAt

    expect(Array.from(indexes.byMonth.values()).flat()).toHaveLength(500)
    expect(indexes.byMonth.get('2026-01')).toHaveLength(100)
    expect(indexes.byAccount.get('account-0')).toHaveLength(125)
    expect(indexes.creditByCard.get('account-0')).toHaveLength(125)
    expect(indexes.reportingTransactions.every(tx => tx.paid && tx.type !== 'transferencia')).toBe(true)
    expect(elapsed).toBeLessThan(250)
  })
})
