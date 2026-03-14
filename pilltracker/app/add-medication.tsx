import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { getMedications } from '../firebase/medications';

const FREQUENCIES = ['Daily', 'Weekly', 'As needed'];
const FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection'];

// Dosage must contain a number followed by a unit (mg, ml, mcg, g, iu, units, drops, puffs, etc.)
const DOSAGE_REGEX = /^\d+(\.\d+)?\s*(mg|ml|mcg|g|iu|units?|drops?|puffs?|%)/i;

type Errors = {
  name?: string;
  dosage?: string;
};

export default function AddMedicationScreen() {
  const [name, setName]           = useState('');
  const [dosage, setDosage]       = useState('');
  const [form, setForm]           = useState('Tablet');
  const [frequency, setFrequency] = useState('Daily');
  const [notes, setNotes]         = useState('');
  const [errors, setErrors]       = useState<Errors>({});
  const [loading, setLoading]     = useState(false);

  const validate = async (): Promise<boolean> => {
    const newErrors: Errors = {};

    // ── Name ──
    if (!name.trim()) {
      newErrors.name = 'Medication name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    } else {
      // Duplicate check — case-insensitive
      const existing = await getMedications();
      const duplicate = existing.some(
        (m: any) => m.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        newErrors.name = `"${name.trim()}" is already in your medications.`;
      }
    }

    // ── Dosage ──
    if (!dosage.trim()) {
      newErrors.dosage = 'Dosage is required.';
    } else if (!DOSAGE_REGEX.test(dosage.trim())) {
      newErrors.dosage = 'Enter a valid dosage (e.g. 500mg, 10ml, 5mcg).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    setLoading(true);
    const valid = await validate();
    setLoading(false);
    if (!valid) return;

    // @ts-ignore
    router.push({
      pathname: '/set-reminders',
      params: { name: name.trim(), dosage: dosage.trim(), form, frequency, notes },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <Text style={styles.title}>+ Add Medication</Text>

        {/* ── Name ── */}
        <Text style={styles.label}>Medication Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="e.g. Metformin"
          value={name}
          onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: undefined })); }}
          autoCapitalize="words"
        />
        {errors.name && <Text style={styles.errorText}>⚠ {errors.name}</Text>}

        <View style={styles.row}>
          {/* ── Dosage ── */}
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Dosage</Text>
            <TextInput
              style={[styles.input, errors.dosage && styles.inputError]}
              placeholder="500mg"
              value={dosage}
              onChangeText={t => { setDosage(t); setErrors(e => ({ ...e, dosage: undefined })); }}
              autoCapitalize="none"
            />
            {errors.dosage && <Text style={styles.errorText}>⚠ {errors.dosage}</Text>}
          </View>

          {/* ── Form ── */}
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Form</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FORMS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, form === f && styles.chipSelected]}
                  onPress={() => setForm(f)}
                >
                  <Text style={[styles.chipText, form === f && styles.chipTextSelected]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ── Frequency ── */}
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, frequency === f && styles.chipSelected]}
              onPress={() => setFrequency(f)}
            >
              <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Notes ── */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Take with food..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryButtonText}>Continue</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 2,
  },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  errorText: { fontSize: 12, color: '#ef4444', marginBottom: 6, marginTop: 2 },
  notesInput: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  chipSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipText: { fontSize: 14, color: '#555' },
  chipTextSelected: { color: '#fff' },
  primaryButton: {
    backgroundColor: '#1a1a1a', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 16,
  },
  primaryButtonDisabled: { backgroundColor: '#999' },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

