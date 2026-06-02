import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction, Account } from '@/constants/types';

const DAILY_REMINDER_STORAGE_KEY = '@horizonte_daily_reminder_id';

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
 * Agenda um lembrete diário unificado
 */
export async function scheduleDailyFinanceSummary(hour = 9, minute = 0) {
  if (Platform.OS === 'web') return;

  try {
    // Cancela apenas o lembrete diário anterior (se existir)
    const previousId = await AsyncStorage.getItem(DAILY_REMINDER_STORAGE_KEY);
    if (previousId) {
      await Notifications.cancelScheduledNotificationAsync(previousId);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Horizonte 💰',
        body: 'Hora de cuidar do seu dinheiro! Confira suas contas e pendências de hoje.',
        sound: true,
      },
      trigger: {
        hour: hour,
        minute: minute,
        repeats: true,
        channelId: 'default',
      },
    });

    // Salva o ID para poder cancelar na próxima vez
    await AsyncStorage.setItem(DAILY_REMINDER_STORAGE_KEY, notificationId);
  } catch (error) {
    console.warn('Erro ao agendar notificação diária:', error);
  }
}

/**
 * Cancela o lembrete diário unificado
 */
export async function cancelDailyFinanceSummary() {
  if (Platform.OS === 'web') return;
  const previousId = await AsyncStorage.getItem(DAILY_REMINDER_STORAGE_KEY);
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId);
    await AsyncStorage.removeItem(DAILY_REMINDER_STORAGE_KEY);
  }
}

