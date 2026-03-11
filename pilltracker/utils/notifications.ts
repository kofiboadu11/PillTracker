import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── PERMISSIONS ────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    // Web notifications use the browser Notification API
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── SCHEDULING ─────────────────────────────────────────────

// Parse a time string like "8:00 AM" or "8:00 PM" into { hour, minute }
const parseTime = (timeStr: string): { hour: number; minute: number } => {
  const [timePart, period] = timeStr.split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
};

/**
 * Schedule daily notifications for a medication.
 * Returns an array of notification IDs (one per time).
 */
export const scheduleMedNotification = async (
  medName: string,
  dosage: string,
  times: string[],
  sound: boolean
): Promise<string[]> => {
  const ids: string[] = [];

  for (const timeStr of times) {
    const { hour, minute } = parseTime(timeStr);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💊 Time to take your medication',
        body: `${medName} ${dosage}`,
        sound: sound,
        data: { medName, dosage },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    ids.push(id);
  }

  return ids;
};

/**
 * Cancel all scheduled notifications for a medication by their IDs.
 */
export const cancelMedNotifications = async (notificationIds: string[]): Promise<void> => {
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
};

/**
 * Cancel ALL scheduled notifications (e.g. on logout).
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
