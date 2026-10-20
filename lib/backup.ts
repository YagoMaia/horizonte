import AsyncStorage from '@react-native-async-storage/async-storage';
import { Account, Transaction, Tag, Project, Goal, HomeSection, TotaisSection, UserSettings, NotificationPreferences, DEFAULT_TAGS } from '@/constants/types';
import { PRIMARY_COLORS } from '@/constants/theme';
import { recoverLedgerWrite } from './ledgerStorage';

export interface BackupData {
  accounts: Account[]; transactions: Transaction[]; tags: Tag[];
  projects: Project[]; goals: Goal[]; monthlyBudgets: Record<string, number>;
  showPending: boolean; hasSeenOnboarding: boolean;
  notificationPreferences: NotificationPreferences;
  homeLayout: HomeSection[]; totaisLayout: TotaisSection[]; userSettings: UserSettings;
  themeMode: 'system' | 'light' | 'dark'; primaryColor: string;
}
const fields: Record<keyof BackupData, string> = {
  accounts: 'accounts', transactions: 'transactions', tags: 'tags', projects: 'projects', goals: 'goals',
  monthlyBudgets: 'monthly_budgets', showPending: 'show_pending', hasSeenOnboarding: 'onboarding',
  notificationPreferences: 'notification_prefs', homeLayout: 'home_layout', totaisLayout: 'totais_layout',
  userSettings: 'user_settings', themeMode: 'theme_mode', primaryColor: 'primary_color',
};
const fieldNames = Object.keys(fields) as (keyof BackupData)[];
const keyFor = (field: keyof BackupData) => `@horizonte:${fields[field]}`;
const storageKeys = fieldNames.map(keyFor);
const JOURNAL_KEY = '@horizonte:restore_journal';
const rawFields = new Set<keyof BackupData>(['themeMode', 'primaryColor']);

function defaults(): BackupData {
  return {
    accounts: [], transactions: [], tags: DEFAULT_TAGS, projects: [], goals: [], monthlyBudgets: {},
    showPending: true, hasSeenOnboarding: true,
    notificationPreferences: {
      dailyReminders: false, dailyReminderTime: { hour: 20, minute: 0 },
      expenseReminders: false, expenseReminderTime: { hour: 9, minute: 0 },
      creditCardAlerts: false, creditCardAlertTime: { hour: 8, minute: 0 },
    },
    homeLayout: ['balance', 'accounts', 'projects', 'goals', 'transactions'].map(id => ({ id, visible: true })) as HomeSection[],
    totaisLayout: ['stats', 'category', 'period'].map(id => ({ id, visible: true })) as TotaisSection[],
    userSettings: { dailyAllowance: 0, safetyMargin: 0 }, themeMode: 'system', primaryColor: PRIMARY_COLORS[0].value,
  };
}
function ensure(condition: unknown, field: string): asserts condition {
  if (!condition) throw new Error(`Backup inválido: ${field}.`);
}
function record(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const text = (value: unknown) => typeof value === 'string' && value.length > 0;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown) => number(value) && (value as number) >= 0;
function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) return false;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isFinite(Date.parse(value)) && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseBackup(input: unknown): { version: string; data: BackupData; legacy: boolean } {
  ensure(record(input), 'estrutura');
  const legacy = input.version === undefined || input.version === '1.0';
  ensure(legacy || input.version === '2.0', 'versão não suportada');
  const source = input.data === undefined ? input : input.data;
  ensure(record(source), 'dados');
  ensure(Array.isArray(source.accounts) && Array.isArray(source.transactions), 'contas e lançamentos');
  if (!legacy) fieldNames.forEach(field => ensure(source[field] !== undefined, field));
  const data = JSON.parse(JSON.stringify({ ...defaults(), ...source })) as BackupData;
  for (const field of ['accounts', 'transactions', 'tags', 'projects', 'goals'] as const) {
    ensure(Array.isArray(data[field]), field);
    const ids = new Set<string>();
    for (const item of data[field]) {
      ensure(record(item) && text(item.id) && !ids.has(item.id), `${field}: identificador`);
      ids.add(item.id);
    }
  }
  for (const a of data.accounts) {
    ensure(text(a.name) && number(a.balance) && text(a.color) && text(a.icon), 'conta');
    ensure(['corrente', 'poupanca', 'investimento', 'carteira', 'cartao_credito'].includes(a.type), 'tipo de conta');
    for (const day of [a.closingDay, a.dueDay]) ensure(day === undefined || (Number.isInteger(day) && day >= 1 && day <= 31), 'dia do cartão');
    ensure(a.creditLimit === undefined || nonnegative(a.creditLimit), 'limite do cartão');
  }
  for (const p of data.projects) ensure(text(p.name) && text(p.color) && nonnegative(p.targetBudget), 'projeto');
  for (const g of data.goals) ensure(text(g.name) && text(g.color) && text(g.icon) && nonnegative(g.targetAmount) && nonnegative(g.savedAmount) && nonnegative(g.monthlyContribution), 'meta');
  for (const t of data.tags) ensure(text(t.label) && text(t.icon) && text(t.color), 'etiqueta');
  const accounts = new Set(data.accounts.map(a => a.id));
  const projects = new Set(data.projects.map(p => p.id));
  const goals = new Set(data.goals.map(g => g.id));
  for (const t of data.transactions) {
    ensure(t.invoiceMonth === undefined || /^\d{4}-(0[1-9]|1[0-2])$/.test(t.invoiceMonth), 'competência da fatura');
    ensure(t.settledAt === undefined || validDate(t.settledAt), 'data de quitação');
    for (const link of [t.cardPaymentId, t.paidCardId, t.settledByPaymentId]) ensure(link === undefined || text(link), 'vínculo de pagamento');
    ensure(typeof t.description === 'string' && nonnegative(t.amount) && validDate(t.date) && typeof t.paid === 'boolean', 'lançamento');
    ensure(['receita', 'despesa', 'transferencia'].includes(t.type), 'tipo de lançamento');
    ensure(['unica', 'diaria', 'dias_uteis', 'semanal', 'mensal', 'anual', 'quinto_dia_util'].includes(t.recurrence), 'recorrência');
    ensure(accounts.has(t.accountId), 'conta do lançamento');
    if (t.type === 'transferencia') ensure(!!t.targetAccountId && accounts.has(t.targetAccountId), 'destino da transferência');
    ensure(t.goalIds === undefined || (Array.isArray(t.goalIds) && t.goalIds.every(text)), 'metas do lançamento');
    // O formato antigo omitia esses cadastros; não manter vínculos órfãos na migração.
    if (legacy) {
      if (t.projectId && !projects.has(t.projectId)) delete t.projectId;
      if (t.goalIds) t.goalIds = t.goalIds.filter(id => goals.has(id));
    }
    ensure(!t.projectId || projects.has(t.projectId), 'projeto inexistente');
    ensure(!t.goalIds || t.goalIds.every(id => goals.has(id)), 'meta inexistente');
  }
  // Os meses persistidos pelo store usam getMonth(): janeiro = 00, dezembro = 11.
  ensure(record(data.monthlyBudgets) && Object.entries(data.monthlyBudgets).every(([key, value]) => /^\d{4}-(0[0-9]|1[01])$/.test(key) && nonnegative(value)), 'orçamentos');
  ensure(typeof data.showPending === 'boolean' && typeof data.hasSeenOnboarding === 'boolean', 'preferências');
  ensure(record(data.userSettings) && nonnegative(data.userSettings.dailyAllowance) && nonnegative(data.userSettings.safetyMargin), 'configurações financeiras');
  for (const value of [data.userSettings.maxMonthlyCreditSpend, data.userSettings.creditSafetyMargin]) ensure(value === undefined || nonnegative(value), 'configurações do cartão');
  const prefs = data.notificationPreferences;
  ensure(record(prefs), 'notificações');
  for (const value of [prefs.dailyReminders, prefs.expenseReminders, prefs.creditCardAlerts]) ensure(typeof value === 'boolean', 'notificações');
  for (const time of [prefs.dailyReminderTime, prefs.expenseReminderTime, prefs.creditCardAlertTime]) {
    ensure(record(time) && Number.isInteger(time.hour) && time.hour >= 0 && time.hour <= 23 && Number.isInteger(time.minute) && time.minute >= 0 && time.minute <= 59, 'horário');
  }
  for (const [layout, allowed] of [[data.homeLayout, ['balance', 'accounts', 'projects', 'goals', 'transactions']], [data.totaisLayout, ['stats', 'category', 'period']]] as const) {
    ensure(Array.isArray(layout), 'organização da tela');
    const ids = new Set<string>();
    for (const section of layout) {
      ensure(record(section) && (allowed as readonly string[]).includes(section.id) && typeof section.visible === 'boolean' && !ids.has(section.id), 'seção da tela');
      ids.add(section.id);
    }
  }
  ensure(['system', 'light', 'dark'].includes(data.themeMode) && /^#[0-9a-f]{6}$/i.test(data.primaryColor), 'tema');
  return { version: legacy ? '1.0' : '2.0', data, legacy };
}
export function buildBackup(data: Record<string, unknown> | BackupData) {
  return { version: '2.0', timestamp: new Date().toISOString(), data: parseBackup({ version: '2.0', data }).data };
}
export async function createBackup() {
  const values = await AsyncStorage.multiGet(storageKeys);
  const data: Record<string, unknown> = { ...defaults() };
  fieldNames.forEach((field, index) => {
    const value = values[index][1];
    if (value !== null) data[field] = rawFields.has(field) ? value : JSON.parse(value);
  });
  return buildBackup(data);
}
async function rollback(previous: readonly (readonly [string, string | null])[]) {
  await AsyncStorage.multiSet(previous.filter((pair): pair is [string, string] => pair[1] !== null));
  await AsyncStorage.multiRemove(previous.filter(pair => pair[1] === null).map(pair => pair[0]));
  await AsyncStorage.removeItem(JOURNAL_KEY);
}
export async function recoverPendingRestore() {
  await recoverLedgerWrite();
  const journal = await AsyncStorage.getItem(JOURNAL_KEY);
  if (!journal) return;
  const previous = JSON.parse(journal);
  ensure(Array.isArray(previous) && previous.length === storageKeys.length && previous.every((pair: unknown, index: number) => Array.isArray(pair) && pair[0] === storageKeys[index] && (pair[1] === null || typeof pair[1] === 'string')), 'recuperação interrompida');
  await rollback(previous);
}
export async function restoreBackup(input: unknown) {
  const { data } = parseBackup(input);
  await recoverPendingRestore();
  const previous = await AsyncStorage.multiGet(storageKeys);
  // O diário permite desfazer a escrita se o app fechar durante a restauração.
  await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(previous));
  try {
    await AsyncStorage.multiSet(fieldNames.map(field => [keyFor(field), rawFields.has(field) ? String(data[field]) : JSON.stringify(data[field])]));
    await AsyncStorage.removeItem(JOURNAL_KEY);
  } catch (error) {
    await rollback(previous);
    throw error;
  }
  return data;
}
