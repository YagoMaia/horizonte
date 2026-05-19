// constants/types.ts

export type TabType = 'saldos' | 'totais' | 'horizonte' | 'contas' | 'menu' | 'cartao' | 'metas' | 'relatorios'

export type TransactionType = 'receita' | 'despesa' | 'transferencia'

export type RecurrenceType = 'unica' | 'diaria' | 'semanal' | 'mensal' | 'anual' | 'quinto_dia_util'

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
  groupId?: string
  groupIndex?: number;
  reminderEnabled?: boolean // If true, the app will notify and NOT auto-process as paid
}

export interface DailyBalance {
  date: string
  balance: number
  income: number
  expense: number
  transactions: Transaction[]
}


export interface SavingsGoal {
  id: string                    // Unique identifier (Date.now().toString())
  name: string                  // 1-50 characters, non-whitespace-only
  targetAmount: number          // 0.01 - 999,999,999.99
  accumulatedAmount: number     // Calculated from deposits on load
  deadline: string | null       // ISO date string or null
  icon: string                  // Ionicons name, default "flag-outline"
  color: string                 // Hex color, default theme primary
  createdAt: string             // ISO date string
  updatedAt: string             // ISO date string
}

export interface GoalDeposit {
  id: string                    // Unique identifier
  goalId: string                // Reference to SavingsGoal.id
  amount: number                // Positive for deposits, negative for withdrawals
  date: string                  // ISO date string (system-generated)
  accountId?: string            // Linked account (optional)
}

export interface CreateGoalInput {
  name: string
  targetAmount: number
  deadline: string | null
  icon: string
  color: string
}

export interface UpdateGoalInput {
  name: string
  targetAmount: number
  deadline: string | null
  icon: string
  color: string
}
