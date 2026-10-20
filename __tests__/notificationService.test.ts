import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { Platform } from 'react-native';
import * as NotificationService from '../services/notificationService';
const mockNotifications = jest.requireMock('expo-notifications');

describe('notificationService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockNotifications.setNotificationChannelAsync.mockResolvedValue(null);
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('new-reminder');
    await AsyncStorage.clear();
  });

  it('cria o canal antes de consultar e pedir a permissão', async () => {
    const calls: string[] = [];
    mockNotifications.setNotificationChannelAsync.mockImplementation(async () => { calls.push('channel'); return null; });
    mockNotifications.getPermissionsAsync.mockImplementation(async () => { calls.push('get'); return { status: 'undetermined' }; });
    mockNotifications.requestPermissionsAsync.mockImplementation(async () => { calls.push('request'); return { status: 'granted' }; });

    await expect(NotificationService.requestPermissions()).resolves.toBe(true);

    expect(calls).toEqual(['channel', 'get', 'request']);
  });

  it('agenda lembrete diário com tipo e canal explícitos', async () => {
    await AsyncStorage.setItem('@horizonte_daily_reminder_id', 'old-reminder');

    await expect(NotificationService.scheduleDailyReminder(20, 15)).resolves.toBe('new-reminder');

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      trigger: {
        type: 'daily',
        hour: 20,
        minute: 15,
        channelId: NotificationService.DEFAULT_NOTIFICATION_CHANNEL_ID,
      },
    }));
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-reminder');
    await expect(AsyncStorage.getItem('@horizonte_daily_reminder_id')).resolves.toBe('new-reminder');
  });

  it('não registra preferência implícita quando a permissão foi negada', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(NotificationService.scheduleDailyReminder(9, 0)).rejects.toThrow('Permissão');
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('propaga falha do agendamento para a interface tratar', async () => {
    mockNotifications.scheduleNotificationAsync.mockRejectedValue(new Error('Falha nativa'));

    await expect(NotificationService.scheduleExpenseReminder(9, 0)).rejects.toThrow('Falha nativa');
  });

  it('cancela e remove o identificador do lembrete', async () => {
    await AsyncStorage.setItem('@horizonte_daily_reminder_id', 'daily-id');

    await NotificationService.cancelDailyReminder();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('daily-id');
    await expect(AsyncStorage.getItem('@horizonte_daily_reminder_id')).resolves.toBeNull();
  });
});

