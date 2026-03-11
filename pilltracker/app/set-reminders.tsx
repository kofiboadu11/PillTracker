import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addMedication } from '../firebase/medications';
import {
  requestNotificationPermissions,
  scheduleMedNotification,
} from '../utils/notifications';

export default function SetRemindersScreen() {
  const { name, dosage, form, frequency, notes } = useLocalSearchParams();

  const [morningTime] = useState('8:00 AM');
  const [eveningTime] = useState('8:00 PM');
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);
  const [snooze, setSnooze] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      let notificationIds: string[] = [];

      if (pushNotifications) {
        const granted = await requestNotificationPermissions();
        if (granted) {
          notificationIds = await scheduleMedNotification(
            String(name),
            String(dosage),
            [morningTime, eveningTime],
            soundAlert
          );
        } else {
          Alert.alert(
            'Permission Denied',
            'Enable notifications in your device settings to receive medication reminders.'
          );
        }
      }

      await addMedication({
        name, dosage, form, frequency, notes,
        times: [morningTime, eveningTime],
        reminders: { pushNotifications, soundAlert, snooze },
        notificationIds,
        createdAt: new Date().toISOString()
      });

      // @ts-ignore
      router.push({
        pathname: '/confirmation',
        params: { name, dosage }
      });
    } catch (error) {
      Alert.alert('Error', 'Could not save medication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>🔔 Set Reminders</Text>

        <View style={styles.medCard}>
          <Text style={styles.medName}>{name} {dosage}</Text>
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.label}>Reminder Time</Text>
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{morningTime}</Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.label}>Second dose</Text>
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{eveningTime}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notification Preferences</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Push Notifications</Text>
          <Switch
            value={pushNotifications}
            onValueChange={setPushNotifications}
            trackColor={{ true: '#1a1a1a' }}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Sound Alert</Text>
          <Switch
            value={soundAlert}
            onValueChange={setSoundAlert}
            trackColor={{ true: '#1a1a1a' }}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Snooze (5 min)</Text>
          <Switch
            value={snooze}
            onValueChange={setSnooze}
            trackColor={{ true: '#1a1a1a' }}
          />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Saving...' : 'Save Reminders'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1a1a1a' },
  medCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16 },
  medName: { fontSize: 16, fontWeight: '600', color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginTop: 8 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  timeText: { fontSize: 16, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleLabel: { fontSize: 15, color: '#333' },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});