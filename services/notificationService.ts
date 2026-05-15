import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
 * Agenda um lembrete diário para as 20h00
 */
export async function scheduleDailyReminder() {
  if (Platform.OS === 'web') return;

  // Limpa agendamentos anteriores para evitar duplicatas
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Horizonte 💰',
      body: 'Hora de cuidar do seu dinheiro! Já registrou seus gastos de hoje?',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
      channelId: 'default',
    },
  });
}

/**
 * Agenda um lembrete de pagamento mensal
 */
export async function scheduleMonthlyPaymentReminder(
  transactionName: string,
  valor: number,
  diaDoMes: number
) {
  if (Platform.OS === 'web') return undefined;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Vencimento Hoje: ${transactionName}`,
      body: `Não esqueça de registrar o pagamento de R$ ${valor.toFixed(2)} no app.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: diaDoMes,
      hour: 9,
      minute: 0,
      repeats: true,
      channelId: 'default',
    },
  });

  return notificationId;
}

/**
 * Agenda um lembrete de pagamento de fatura de cartão
 */
export async function scheduleCreditCardReminder(
  cardName: string,
  dueDay: number
) {
  if (Platform.OS === 'web') return undefined;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Fatura do Cartão: ${cardName}`,
      body: `Sua fatura vence hoje. Não esqueça de conferir os lançamentos e realizar o pagamento!`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: dueDay,
      hour: 8,
      minute: 0,
      repeats: true,
      channelId: 'default',
    },
  });

  return notificationId;
}

/**
 * Cancela um lembrete agendado
 */
export async function cancelReminder(notificationId: string) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
