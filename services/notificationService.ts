import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_NOTIFICATION_CHANNEL_ID = 'default';

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

function isNativePlatform() {
  return Platform.OS !== 'web';
}

function validateTime(hour: number, minute: number) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('Horário de notificação inválido.');
  }
}

export async function ensureNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    name: 'Lembretes do Horizonte',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

export async function hasNotificationPermission() {
  if (!isNativePlatform()) return false;

  await ensureNotificationChannel();
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Prepara o canal Android e solicita autorização somente quando a pessoa ativa notificações.
 */
export async function requestPermissions() {
  if (!isNativePlatform()) return false;

  await ensureNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleReminder(key: string, title: string, body: string, hour: number, minute: number) {
  if (!isNativePlatform()) return null;

  validateTime(hour, minute);

  if (!(await hasNotificationPermission())) {
    throw new Error('Permissão de notificações não concedida.');
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: DEFAULT_NOTIFICATION_CHANNEL_ID,
    },
  });

  const previousId = await AsyncStorage.getItem(key);
  if (previousId && previousId !== notificationId) {
    await Notifications.cancelScheduledNotificationAsync(previousId);
  }

  await AsyncStorage.setItem(key, notificationId);
  return notificationId;
}

async function cancelReminder(key: string) {
  if (!isNativePlatform()) return;

  const previousId = await AsyncStorage.getItem(key);
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId);
  }
  await AsyncStorage.removeItem(key);
}

export async function scheduleDailyReminder(hour = 9, minute = 0) {
  return scheduleReminder(
    DAILY_REMINDER_STORAGE_KEY,
    'Horizonte 💰',
    'Hora de cuidar do seu dinheiro! Confira suas contas e pendências de hoje.',
    hour,
    minute,
  );
}

export async function cancelDailyReminder() {
  return cancelReminder(DAILY_REMINDER_STORAGE_KEY);
}

export async function scheduleExpenseReminder(hour = 20, minute = 0) {
  return scheduleReminder(
    EXPENSE_REMINDER_STORAGE_KEY,
    'Registro de despesas 📝',
    'Reserve um momento para registrar os gastos de hoje.',
    hour,
    minute,
  );
}

export async function cancelExpenseReminder() {
  return cancelReminder(EXPENSE_REMINDER_STORAGE_KEY);
}

export async function scheduleCreditCardAlert(hour = 10, minute = 0) {
  return scheduleReminder(
    CREDIT_CARD_REMINDER_STORAGE_KEY,
    'Organize o cartão 💳',
    'Confira o fechamento e o vencimento das suas faturas de cartão.',
    hour,
    minute,
  );
}

export async function cancelCreditCardAlert() {
  return cancelReminder(CREDIT_CARD_REMINDER_STORAGE_KEY);
}

