import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addMedication } from '../firebase/medications';
import {
  requestNotificationPermissions,
  scheduleMedNotification,
  SOUND_OPTIONS,
  type SoundOption,
} from '../utils/notifications';

// ─── Time Picker Modal ────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

interface TimePickerModalProps {
  visible: boolean;
  currentTime: string;
  label: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
}

function TimePickerModal({ visible, currentTime, label, onConfirm, onClose }: TimePickerModalProps) {
  // Parse current time into parts, e.g. "8:30 PM" → hour="08", min="30", period="PM"
  const parse = (t: string) => {
    const [timePart, period] = t.split(' ');
    const [h, m] = timePart.split(':');
    return {
      hour: String(Number(h)).padStart(2, '0'),
      minute: String(Number(m)).padStart(2, '0'),
      period: period ?? 'AM',
    };
  };

  const parsed = parse(currentTime);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  const handleConfirm = () => {
    onConfirm(`${Number(hour)}:${minute} ${period}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>{label}</Text>

          <View style={styles.pickerRow}>
            {/* Hour */}
            <View style={styles.pickerCol}>
              <Text style={styles.pickerColLabel}>Hour</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerItem, hour === h && styles.pickerItemActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.pickerItemText, hour === h && styles.pickerItemTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minute */}
            <View style={styles.pickerCol}>
              <Text style={styles.pickerColLabel}>Min</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, minute === m && styles.pickerItemActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.pickerItemText, minute === m && styles.pickerItemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* AM / PM */}
            <View style={styles.pickerCol}>
              <Text style={styles.pickerColLabel}>AM/PM</Text>
              <View style={styles.pickerScroll}>
                {PERIODS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pickerItem, period === p && styles.pickerItemActive]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text style={[styles.pickerItemText, period === p && styles.pickerItemTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.pickerActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SetRemindersScreen() {
  const { name, dosage, form, frequency, notes } = useLocalSearchParams();

  // Build initial time slots based on frequency
  const defaultTimes = () => {
    const freq = String(frequency).toLowerCase();
    if (freq === 'twice daily') return ['8:00 AM', '8:00 PM'];
    return ['8:00 AM'];
  };

  const [times, setTimes] = useState<string[]>(defaultTimes());
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);
  const [selectedSound, setSelectedSound] = useState<SoundOption>('default');
  const [snooze, setSnooze] = useState(true);
  const [loading, setLoading] = useState(false);

  const updateTime = (index: number, newTime: string) => {
    setTimes(prev => prev.map((t, i) => (i === index ? newTime : t)));
  };

  const addTimeSlot = () => {
    if (times.length >= 4) return;
    setTimes(prev => [...prev, '12:00 PM']);
  };

  const removeTimeSlot = (index: number) => {
    if (times.length <= 1) return;
    setTimes(prev => prev.filter((_, i) => i !== index));
  };

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
            times,
            soundAlert,
            selectedSound,
            snooze
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
        times,
        reminders: { pushNotifications, soundAlert, selectedSound, snooze },
        notificationIds,
        createdAt: new Date().toISOString()
      });

      // @ts-ignore
      router.push({
        pathname: '/confirmation',
        params: { name, dosage, times: times.join(', ') }
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
          <Text style={styles.medName}>{name} — {dosage}</Text>
          <Text style={styles.medFreq}>{frequency}</Text>
        </View>

        {/* ── Time Slots ── */}
        <Text style={styles.sectionTitle}>Reminder Times</Text>
        <Text style={styles.hint}>Tap a time to change it</Text>

        {times.map((t, i) => (
          <View key={i} style={styles.timeRow}>
            <Text style={styles.doseLabel}>Dose {i + 1}</Text>
            <TouchableOpacity style={styles.timeBox} onPress={() => setPickerIndex(i)}>
              <Text style={styles.timeText}>🕐 {t}</Text>
            </TouchableOpacity>
            {times.length > 1 && (
              <TouchableOpacity onPress={() => removeTimeSlot(i)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {times.length < 4 && (
          <TouchableOpacity style={styles.addTimeBtn} onPress={addTimeSlot}>
            <Text style={styles.addTimeBtnText}>+ Add another time</Text>
          </TouchableOpacity>
        )}

        {/* ── Notification Preferences ── */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Notification Preferences</Text>

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

        {/* ── Sound Picker (only shown when sound is on) ── */}
        {soundAlert && (
          <View style={styles.soundPickerContainer}>
            <Text style={styles.soundPickerLabel}>Notification Sound</Text>
            <View style={styles.soundPickerRow}>
              {SOUND_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.soundOption,
                    selectedSound === opt.id && styles.soundOptionActive,
                  ]}
                  onPress={() => setSelectedSound(opt.id)}
                >
                  <Text style={styles.soundOptionEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.soundOptionText,
                      selectedSound === opt.id && styles.soundOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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

      {/* ── Time Picker Modal ── */}
      {pickerIndex !== null && (
        <TimePickerModal
          visible={pickerIndex !== null}
          currentTime={times[pickerIndex]}
          label={`Set time for Dose ${pickerIndex + 1}`}
          onConfirm={(newTime) => updateTime(pickerIndex, newTime)}
          onClose={() => setPickerIndex(null)}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1a1a1a' },
  medCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 4 },
  medName: { fontSize: 16, fontWeight: '600', color: '#333' },
  medFreq: { fontSize: 13, color: '#888' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  hint: { fontSize: 12, color: '#aaa', marginTop: -8 },
  doseLabel: { fontSize: 14, fontWeight: '600', color: '#555', width: 60 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeBox: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  timeText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  removeBtn: {
    padding: 8,
  },
  removeBtnText: { fontSize: 18, color: '#cc0000' },
  addTimeBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addTimeBtnText: { fontSize: 14, color: '#666' },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
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

  // ── Modal styles ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    gap: 16,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pickerCol: { alignItems: 'center', flex: 1 },
  pickerColLabel: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 6 },
  pickerScroll: { maxHeight: 180 },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginVertical: 2,
    alignItems: 'center',
  },
  pickerItemActive: { backgroundColor: '#1a1a1a' },
  pickerItemText: { fontSize: 18, fontWeight: '600', color: '#333' },
  pickerItemTextActive: { color: '#fff' },
  pickerActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#555' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // ── Sound Picker styles ──
  soundPickerContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  soundPickerLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
  soundPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  soundOptionActive: {
    borderColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
  },
  soundOptionEmoji: { fontSize: 14 },
  soundOptionText: { fontSize: 13, fontWeight: '600', color: '#444' },
  soundOptionTextActive: { color: '#fff' },
});