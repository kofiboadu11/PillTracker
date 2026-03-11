import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function ConfirmationScreen() {
  const { name, dosage, times } = useLocalSearchParams();

  const timesDisplay = times
    ? String(times)
    : null;

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.iconCircle}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      <Text style={styles.title}>All Set!</Text>

      <Text style={styles.description}>
        <Text style={{ fontWeight: '600' }}>{name} {dosage}</Text> has been added
        to your medication list
        {timesDisplay
          ? ` with daily reminders at ${timesDisplay}.`
          : '.'}
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        // @ts-ignore
        onPress={() => router.push('/dashboard')}
      >
        <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        // @ts-ignore
        onPress={() => router.push('/add-medication')}
      >
        <Text style={styles.secondaryButtonText}>+ Add Another Medication</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: { fontSize: 48, color: '#1a1a1a' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a' },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#333', fontSize: 17 },
});