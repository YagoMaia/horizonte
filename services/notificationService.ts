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

  try {
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
  } catch (error) {
    console.warn('Erro ao agendar notificação diária:', error);
  }
}

/**
 * Agenda um lembrete para um lançamento recorrente ou único
 */
export async function scheduleTransactionReminder(
  transactionName: string,
  valor: number,
  dueDate: Date
) {
  if (Platform.OS === 'web') return undefined;

  // Gatilho para as 09:00 da manhã do dia do vencimento
  const triggerDate = new Date(dueDate);
  triggerDate.setHours(9, 0, 0, 0);

  // Não agenda se a data já passou
  if (triggerDate.getTime() <= Date.now()) {
    return undefined;
  }

  const valorFormatado = `R$ ${valor.toFixed(2).replace('.', ',')}`;

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vencimento Próximo: Lançamento Recorrente',
        body: `O lançamento '${transactionName}' no valor de ${valorFormatado} vence em breve. Garanta o saldo em conta!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'default',
      },
    });

    return notificationId;
  } catch (error) {
    console.warn('Erro ao agendar notificação de transação:', error);
    return undefined;
  }
}

/**
 * Agenda um lembrete de pagamento de fatura de cartão
 */
export async function scheduleCreditCardReminder(
  cardName: string,
  dueDay: number
) {
  if (Platform.OS === 'web') return undefined;

  try {
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
  } catch (error) {
    console.warn('Erro ao agendar notificação de cartão de crédito:', error);
    return undefined;
  }
}

/**
 * Cancela um lembrete agendado
 */
export async function cancelReminder(notificationId: string) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
