import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { snoozeMedNotification, type SoundOption } from '../utils/notifications';

export default function RootLayout() {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Listen for user interactions with notifications (e.g. tapping Snooze action)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { medName, dosage, soundOption, snoozed } = response.notification.request.content.data as {
        medName?: string;
        dosage?: string;
        soundOption?: SoundOption;
        snoozed?: boolean;
      };

      const actionId = response.actionIdentifier;

      // If the user tapped the "snooze" action button and it hasn't already been snoozed
      if (actionId === 'snooze' && medName && dosage && !snoozed) {
        snoozeMedNotification(medName, dosage, soundOption ?? 'default', 5);
      }
    });

    // Register notification categories with a Snooze action button
    Notifications.setNotificationCategoryAsync('medication', [
      {
        identifier: 'snooze',
        buttonTitle: '⏰ Snooze 5 min',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
    ]);

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="add-medication" />
      <Stack.Screen name="edit-medication" />
      <Stack.Screen name="set-reminders" />
      <Stack.Screen name="confirmation" />
      <Stack.Screen name="adherence" />
    </Stack>
  );
}