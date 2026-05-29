// constants/types.ts

export type TabType = 'saldos' | 'totais' | 'horizonte' | 'menu' | 'cartao' | 'contas' | 'projetos' | 'metas' | 'home_layout'

export type TransactionType = 'receita' | 'despesa' | 'transferencia'

export type RecurrenceType = 'unica' | 'diaria' | 'semanal' | 'mensal' | 'anual' | 'quinto_dia_util'

export interface Project {
  id: string
  name: string
  targetBudget: number
  color: string
  active?: boolean
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  monthlyContribution: number;
  savedAmount: number;
  color: string;
  icon: string;
}

export interface Account {
  id: string
  name: string
  balance: number // For checking: available money. For credit cards: current invoice total (usually negative or tracked as owed).
  type: 'corrente' | 'poupanca' | 'investimento' | 'carteira' | 'cartao_credito' // 👉 Added 'cartao_credito'
  color: string
  icon: string
  // Optional specific properties for credit cards
  closingDay?: number;
  dueDay?: number;
  notificationId?: string;
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
  isAdjustment?: boolean;
  notificationId?: string;
  projectId?: string; // 👉 Novo: ID do projeto vinculado
  goalId?: string; // 👉 Novo: ID da meta vinculada
  notifyRecurrence?: boolean; // 👉 Novo: Preferência individual de notificação para a recorrência
}

export type HomeSectionId = 'balance' | 'accounts' | 'projects' | 'goals' | 'transactions';

export interface HomeSection {
  id: HomeSectionId;
  visible: boolean;
}

export interface Tag {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export interface NotificationPreferences {
  dailyReminders: boolean;
  dailyReminderTime: { hour: number; minute: number };
  expenseReminders: boolean;
  expenseReminderTime: { hour: number; minute: number };
  creditCardAlerts: boolean;
  creditCardAlertTime: { hour: number; minute: number };
}

export const DEFAULT_TAGS: Tag[] = [
  { id: '1', label: 'Lazer', icon: 'sunny', color: '#FF9500' },
  { id: '2', label: 'Alimentação', icon: 'restaurant', color: '#FF3B30' },
  { id: '3', label: 'Transporte', icon: 'car', color: '#007AFF' },
  { id: '4', label: 'Saúde', icon: 'heart', color: '#4CD964' },
  { id: '5', label: 'Educação', icon: 'book', color: '#5856D6' },
  { id: '6', label: 'Moradia', icon: 'home', color: '#8E8E93' },
  { id: '7', label: 'Outros', icon: 'ellipsis-horizontal', color: '#AFB1B6' },
];

