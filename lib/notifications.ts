import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Transaction, Account } from '@/constants/types';
import { formatCurrency } from './utils';

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
