import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_REMINDER_STORAGE_KEY = '@horizonte_daily_reminder_id';
const EXPENSE_REMINDER_STORAGE_KEY = '@horizonte_expense_reminder_id';
const CREDIT_CARD_REMINDER_STORAGE_KEY = '@horizonte_credit_card_reminder_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Pede autorização ao usuário para enviar notificações
 */
export async function requestPermissions() {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Permissão de notificação não concedida!');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Lembretes Padrão',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return true;
}

/**
 * Funções auxiliares genéricas para agendar e cancelar
 */
async function scheduleReminder(key: string, title: string, body: string, hour: number, minute: number) {
  if (Platform.OS === 'web') return;

  try {
    const previousId = await AsyncStorage.getItem(key);
    if (previousId) {
      await Notifications.cancelScheduledNotificationAsync(previousId);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    await AsyncStorage.setItem(key, notificationId);
  } catch (error) {
    console.warn(`Erro ao agendar notificação (${title}):`, error);
  }
}

async function cancelReminder(key: string) {
  if (Platform.OS === 'web') return;
  const previousId = await AsyncStorage.getItem(key);
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId);
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Lembrete Diário
 */
export async function scheduleDailyReminder(hour = 9, minute = 0) {
  await scheduleReminder(
    DAILY_REMINDER_STORAGE_KEY,
    'Horizonte 💰',
    'Hora de cuidar do seu dinheiro! Confira suas contas e pendências de hoje.',
    hour,
    minute
  );
}

export async function cancelDailyReminder() {
  await cancelReminder(DAILY_REMINDER_STORAGE_KEY);
}

/**
 * Lembrete de Despesas
 */
export async function scheduleExpenseReminder(hour = 20, minute = 0) {
  await scheduleReminder(
    EXPENSE_REMINDER_STORAGE_KEY,
    'Registro de Despesas 📝',
    'Não se esqueça de registrar os gastos que você teve hoje!',
    hour,
    minute
  );
}

export async function cancelExpenseReminder() {
  await cancelReminder(EXPENSE_REMINDER_STORAGE_KEY);
}

/**
 * Alerta de Cartão de Crédito
 */
export async function scheduleCreditCardAlert(hour = 10, minute = 0) {
  await scheduleReminder(
    CREDIT_CARD_REMINDER_STORAGE_KEY,
    'Faturas de Cartão 💳',
    'Fique de olho no fechamento e vencimento das suas faturas de cartão de crédito.',
    hour,
    minute
  );
}

export async function cancelCreditCardAlert() {
  await cancelReminder(CREDIT_CARD_REMINDER_STORAGE_KEY);
}

