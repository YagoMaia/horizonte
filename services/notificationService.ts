import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configuração do Serviço: Handler para exibir alertas com som mesmo com app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pede autorização ao usuário para enviar notificações
 */
export async function requestPermissions() {
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
      name: 'default',
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
  // Limpa agendamentos anteriores para evitar duplicatas
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Horizonte 💰',
      body: 'Hora de cuidar do seu dinheiro! Já registrou seus gastos de hoje?',
      sound: true,
    },
    trigger: {
      hour: 20,
      minute: 0,
      repeats: true,
    } as Notifications.DailyTriggerInput,
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
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Vencimento Hoje: ${transactionName}`,
      body: `Não esqueça de registrar o pagamento de R$ ${valor.toFixed(2)} no app.`,
      sound: true,
    },
    trigger: {
      day: diaDoMes,
      hour: 9,
      minute: 0,
      repeats: true,
    } as Notifications.CalendarTriggerInput,
  });

  return notificationId;
}

/**
 * Cancela um lembrete agendado
 */
export async function cancelReminder(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
