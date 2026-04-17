import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── SOUND OPTIONS ──────────────────────────────────────────

export type SoundOption = 'pill-reminder' | 'gentle-chime' | 'alert-beep' | 'default';

export const SOUND_OPTIONS: { id: SoundOption; label: string; emoji: string }[] = [
  { id: 'default',       label: 'Default',        emoji: '🔔' },
  { id: 'pill-reminder', label: 'Pill Reminder',   emoji: '💊' },
  { id: 'gentle-chime',  label: 'Gentle Chime',    emoji: '🎵' },
  { id: 'alert-beep',    label: 'Alert Beep',      emoji: '📢' },
];

// iOS: filename in the app bundle (placed there by the expo-notifications plugin in app.json)
// Android: filename in res/raw (also placed by the plugin)
// 'default' uses the system default notification sound
const SOUND_FILE: Record<SoundOption, string | boolean> = {
  'default':       true,
  'pill-reminder': 'pill-reminder.wav',
  'gentle-chime':  'gentle-chime.wav',
  'alert-beep':    'alert-beep.wav',
};

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

// ─── ANDROID CHANNELS ───────────────────────────────────────
// Android 8+ (API 26+) requires a notification channel to play custom sounds.
// Each sound option gets its own channel so the sound is respected.
// Must be called once at app startup (see _layout.tsx).

export const setupNotificationChannels = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
    // no sound field = uses system default
  });

  await Notifications.setNotificationChannelAsync('pill-reminder', {
    name: 'Pill Reminder',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'pill-reminder.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
  });

  await Notifications.setNotificationChannelAsync('gentle-chime', {
    name: 'Gentle Chime',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'gentle-chime.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
  });

  await Notifications.setNotificationChannelAsync('alert-beep', {
    name: 'Alert Beep',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'alert-beep.wav',
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#ef4444',
  });
};

// ─── PERMISSIONS ────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
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
  sound: boolean,
  soundOption: SoundOption = 'default',
  snoozeEnabled: boolean = false
): Promise<string[]> => {
  const ids: string[] = [];

  // iOS uses the sound filename directly; Android uses its channel.
  // Web falls back to the browser default.
  const resolvedSound: string | boolean =
    Platform.OS === 'web' ? sound : (sound ? SOUND_FILE[soundOption] : false);

  // Android: pick the channel that matches the chosen sound.
  // If sound is disabled use the default (silent) channel.
  const channelId: string = sound ? soundOption : 'default';

  for (const timeStr of times) {
    const { hour, minute } = parseTime(timeStr);

    const content: Notifications.NotificationContentInput = {
      title: '💊 Time to take your medication',
      body: `${medName} ${dosage}`,
      sound: resolvedSound,
      data: { medName, dosage, soundOption },
    };

    if (snoozeEnabled) {
      content.categoryIdentifier = 'medication';
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' && { channelId }),
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

/**
 * Snooze a medication notification by 5 minutes.
 */
export const snoozeMedNotification = async (
  medName: string,
  dosage: string,
  soundOption: SoundOption = 'default',
  snoozeMinutes: number = 5
): Promise<string> => {
  const resolvedSound: string | boolean =
    Platform.OS === 'web' ? true : SOUND_FILE[soundOption];

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ Snooze reminder — ${medName}`,
      body: `Don't forget your ${dosage} dose!`,
      sound: resolvedSound,
      data: { medName, dosage, soundOption, snoozed: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: snoozeMinutes * 60,
      ...(Platform.OS === 'android' && { channelId: soundOption }),
    },
  });

  return id;
};
