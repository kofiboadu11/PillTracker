import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { updateMedication } from '../firebase/medications';

const FREQUENCIES = ['Daily', 'Weekly', 'As needed'];
const FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection'];

const DOSAGE_REGEX = /^\d+(\.\d+)?\s*(mg|ml|mcg|g|iu|units?|drops?|puffs?|%)/i;

type Errors = { name?: string; dosage?: string };

export default function EditMedicationScreen() {
  const params = useLocalSearchParams();

  const [name, setName] = useState(String(params.name || ''));
  const [dosage, setDosage] = useState(String(params.dosage || ''));
  const [form, setForm] = useState(String(params.form || 'Tablet'));
  const [frequency, setFrequency] = useState(String(params.frequency || 'Daily'));
  const [notes, setNotes] = useState(String(params.notes || ''));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const validate = (): boolean => {
    const newErrors: Errors = {};
    if (!name.trim()) {
      newErrors.name = 'Medication name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }
    if (!dosage.trim()) {
      newErrors.dosage = 'Dosage is required.';
    } else if (!DOSAGE_REGEX.test(dosage.trim())) {
      newErrors.dosage = 'Enter a valid dosage (e.g. 500mg, 10ml, 5mcg).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await updateMedication(String(params.id), {
        name: name.trim(),
        dosage: dosage.trim(),
        form,
        frequency,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', `${name.trim()} has been updated.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Could not update medication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Medication</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>Medication Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="e.g. Metformin"
          value={name}
          onChangeText={t => { setName(t); if (errors.name) setErrors(e => ({ ...e, name: undefined })); }}
          autoCapitalize="words"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        {/* Dosage */}
        <Text style={styles.label}>Dosage</Text>
        <TextInput
          style={[styles.input, errors.dosage && styles.inputError]}
          placeholder="e.g. 500mg"
          value={dosage}
          onChangeText={t => { setDosage(t); if (errors.dosage) setErrors(e => ({ ...e, dosage: undefined })); }}
        />
        {errors.dosage && <Text style={styles.errorText}>{errors.dosage}</Text>}

        {/* Form */}
        <Text style={styles.label}>Form</Text>
        <View style={styles.chipRow}>
          {FORMS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, form === f && styles.chipSelected]}
              onPress={() => setForm(f)}
            >
              <Text style={[styles.chipText, form === f && styles.chipTextSelected]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Frequency */}
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, frequency === f && styles.chipSelected]}
              onPress={() => setFrequency(f)}
            >
              <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="e.g. Take with food..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backButton: { padding: 4 },
  backText: { fontSize: 16, color: '#555' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
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
  chipRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  chipSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipText: { fontSize: 14, color: '#555' },
  chipTextSelected: { color: '#fff' },
  saveButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: { backgroundColor: '#999' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
