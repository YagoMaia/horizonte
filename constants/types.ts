// constants/types.ts

export type TabType = 'saldos' | 'totais' | 'horizonte' | 'contas' | 'tags' | 'menu' | 'cartao'

export type TransactionType = 'receita' | 'despesa' | 'transferencia'

export type RecurrenceType = 'unica' | 'diaria' | 'semanal' | 'mensal' | 'anual'

export interface Tag {
  id: string
  name: string
  color: string
  icon: string
}

export interface Account {
  id: string
  name: string
  balance: number // For checking: available money. For credit cards: current invoice total (usually negative or tracked as owed).
  type: 'corrente' | 'poupanca' | 'investimento' | 'carteira' | 'cartao_credito' // 👉 Added 'cartao_credito'
  color: string
  icon: string
  // Optional specific properties for credit cards
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
}

export interface Transaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  date: string
  accountId: string
  toAccountId?: string
  tagIds: string[]
  recurrence: RecurrenceType
  paid: boolean
  notes?: string
  paymentMethod?: 'debito' | 'credito' // Tracks the method used
  installmentNumber?: number // E.g., 1 (for 1/3)
  totalInstallments?: number // E.g., 3 (for 1/3)
  isRecurring?: boolean
  recurrenceInterval?: 'diario' | 'semanal' | 'mensal' | 'anual'
  recurrenceStartDate?: string
  recurrenceEndDate?: string
  targetAccountId?: string
}

export interface DailyBalance {
  date: string
  balance: number
  income: number
  expense: number
  transactions: Transaction[]
}