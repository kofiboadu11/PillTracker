import { Stack } from 'expo-router';

export default function RootLayout() {
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