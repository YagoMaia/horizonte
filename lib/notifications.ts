import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account } from '@/constants/types';
import { formatCurrency } from './utils';

const NOTIFICATION_REGISTRY_KEY = '@horizonte:notification_registry';

type NotificationRegistryEntry = {
  id: string;
  signature: string;
};

type NotificationRegistry = Record<string, NotificationRegistryEntry>;

type DesiredNotification = {
  signature: string;
  schedule: () => Promise<string | undefined>;
};

// Serializa as reconciliações para evitar que duas atualizações de estado
// agendem e cancelem notificações simultaneamente.
let reconciliationQueue: Promise<void> = Promise.resolve();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    // console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function scheduleTransactionNotification(tx: Transaction) {
  if (!tx.reminderEnabled || tx.paid) return;

  try {
    const txDate = new Date(tx.date);
    // Set to 8:00 AM on the day of transaction
    txDate.setHours(8, 0, 0, 0);

    if (txDate <= new Date()) {
      // If it's today or past, schedule for 1 minute from now
      txDate.setTime(new Date().getTime() + 60000); 
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lembrete de Pagamento',
        body: `Não esqueça de pagar: ${tx.description} - ${formatCurrency(tx.amount)}`,
        data: { txId: tx.id },
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: txDate },
    });

    return identifier;
  } catch (e) {
    console.error('Erro ao agendar notificação de transação:', e);
    return undefined;
  }
}

export async function scheduleCardClosingNotification(account: Account) {
  if (account.type !== 'cartao_credito' || !account.closingDay) return;

  try {
    const now = new Date();
    const closingDate = new Date(now.getFullYear(), now.getMonth(), account.closingDay, 9, 0, 0);

    if (closingDate <= now) {
      closingDate.setMonth(closingDate.getMonth() + 1);
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Fatura Fechando',
        body: `A fatura do cartão ${account.name} fecha hoje!`,
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: closingDate },
    });
  } catch (e) {
    console.error('Erro ao agendar notificação de fechamento:', e);
    return undefined;
  }
}

export async function scheduleCardDueNotification(account: Account) {
  if (account.type !== 'cartao_credito' || !account.dueDay) return;

  try {
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), account.dueDay, 8, 0, 0);

    if (dueDate <= now) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vencimento de Fatura',
        body: `A fatura do cartão ${account.name} vence hoje. Já pagou?`,
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: dueDate },
    });
  } catch (e) {
    console.error('Erro ao agendar notificação de vencimento:', e);
    return undefined;
  }
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function clearNotificationRegistry() {
  await AsyncStorage.removeItem(NOTIFICATION_REGISTRY_KEY);
}

async function cancelScheduledNotification(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    // O agendamento pode já ter sido removido pelo sistema operacional.
    console.warn('Não foi possível cancelar uma notificação antiga:', error);
  }
}

function getNotificationSignature(value: unknown) {
  return JSON.stringify(value);
}

/**
 * Mantém somente as notificações que correspondem ao estado atual da store.
 * A rotina usa um registro persistido para cancelar apenas itens removidos ou
 * alterados, em vez de cancelar e recriar todos os agendamentos.
 */
export function reconcileNotifications(
  accounts: Account[],
  transactions: Transaction[],
): Promise<void> {
  const run = async () => {
    let registry: NotificationRegistry = {};
    let shouldResetLegacySchedules = false;

    try {
      const raw = await AsyncStorage.getItem(NOTIFICATION_REGISTRY_KEY);
      if (raw === null) {
        shouldResetLegacySchedules = true;
      } else {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          shouldResetLegacySchedules = true;
        } else {
          registry = parsed as NotificationRegistry;
        }
      }
    } catch (error) {
      console.warn('Registro de notificações inválido; recriando:', error);
      shouldResetLegacySchedules = true;
    }

    if (shouldResetLegacySchedules) {
      await cancelAllNotifications();
      registry = {};
    }

    const desired = new Map<string, DesiredNotification>();

    for (const account of accounts) {
      if (account.type !== 'cartao_credito') continue;

      if (account.closingDay) {
        const key = `card:${account.id}:closing`;
        desired.set(key, {
          signature: getNotificationSignature({
            kind: 'closing',
            name: account.name,
            closingDay: account.closingDay,
          }),
          schedule: () => scheduleCardClosingNotification(account),
        });
      }

      if (account.dueDay) {
        const key = `card:${account.id}:due`;
        desired.set(key, {
          signature: getNotificationSignature({
            kind: 'due',
            name: account.name,
            dueDay: account.dueDay,
          }),
          schedule: () => scheduleCardDueNotification(account),
        });
      }
    }

    for (const transaction of transactions) {
      if (!transaction.reminderEnabled || transaction.paid) continue;

      const key = `transaction:${transaction.id}`;
      desired.set(key, {
        signature: getNotificationSignature({
          kind: 'transaction',
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          reminderEnabled: transaction.reminderEnabled,
          paid: transaction.paid,
        }),
        schedule: () => scheduleTransactionNotification(transaction),
      });
    }

    for (const [key, entry] of Object.entries(registry)) {
      const expected = desired.get(key);
      if (!expected || expected.signature !== entry.signature) {
        await cancelScheduledNotification(entry.id);
        delete registry[key];
      }
    }

    for (const [key, expected] of desired) {
      if (registry[key]) continue;

      const id = await expected.schedule();
      if (id) {
        registry[key] = { id, signature: expected.signature };
      }
    }

    await AsyncStorage.setItem(NOTIFICATION_REGISTRY_KEY, JSON.stringify(registry));
  };

  const queued = reconciliationQueue.then(run, run);
  reconciliationQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}
