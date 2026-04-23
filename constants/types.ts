// constants/types.ts

export type TabType = 'saldos' | 'totais' | 'horizonte' | 'contas' | 'tags' | 'menu'

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
  balance: number
  type: 'corrente' | 'poupanca' | 'investimento' | 'carteira'
  color: string
  icon: string
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
  isRecurring?: boolean;
  recurrenceInterval?: 'diario' | 'semanal' | 'mensal' | 'anual';
  recurrenceStartDate?: string; // Data de início em formato ISO
  recurrenceEndDate?: string;   // Data de fim em formato ISO (opcional)
}

export interface DailyBalance {
  date: string
  balance: number
  income: number
  expense: number
  transactions: Transaction[]
}
