import React, { useState, useCallback } from 'react';

import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Modal
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { auth } from '../firebase/config';
import { signOut } from "firebase/auth";
import { getMedications, toggleMedication, getAdherenceForDate, deleteMedication, initializeTodayAdherence } from '../firebase/medications';
import { cancelMedNotifications } from '../utils/notifications';

export default function DashboardScreen() {
  const [medications, setMedications] = useState<any[]>([]);
  const [takenMeds, setTakenMeds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const userName = auth.currentUser?.displayName?.split(' ')[0] || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const meds = await getMedications();
          setMedications(meds);

          const today = new Date().toISOString().split('T')[0];

          // Initialize today's adherence — write false for any med not yet tracked
          await initializeTodayAdherence(meds.map((m: any) => m.id));

          const adherence = await getAdherenceForDate(today);
          setTakenMeds(adherence);
        } catch (error) {
          Alert.alert('Error', 'Could not load medications.');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  const handleMarkTaken = async (medId: string) => {
    try {
      const newValue = !takenMeds[medId];
      await toggleMedication(medId, newValue);
      setTakenMeds(prev => ({ ...prev, [medId]: newValue }));
    } catch (error) {
      Alert.alert('Error', 'Could not update medication status.');
    }
  };

  const handleDelete = (medId: string, medName: string, notificationIds: string[] = []) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete ${medName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel scheduled notifications first
              if (notificationIds.length > 0) {
                await cancelMedNotifications(notificationIds);
              }
              await deleteMedication(medId);
              setMedications(prev => prev.filter(m => m.id !== medId));
            } catch (error) {
              Alert.alert('Error', 'Could not delete medication.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setProfileMenuVisible(false);
      router.replace('/login');
    } catch (error) {
      Alert.alert('Error', 'Could not log out.');
    }
  };

  const takenCount = medications.filter(m => takenMeds[m.id] === true).length;
  const missedCount = medications.filter(m => takenMeds[m.id] === false).length;
  const totalCount = medications.length;
  const progressPercent = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <Text style={styles.settingsText}>⚙️</Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Today's Progress</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <Text style={styles.progressStatTaken}>✓ {takenCount} taken</Text>
            <Text style={styles.progressCount}>{takenCount}/{totalCount}</Text>
            {missedCount > 0 && (
              <Text style={styles.progressStatMissed}>✗ {missedCount} missed</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>TODAY'S MEDICATIONS</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading medications...</Text>
        ) : medications.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            // @ts-ignore
            onPress={() => router.push('/add-medication')}
          >
            <Text style={styles.emptyText}>+ Add your first medication</Text>
          </TouchableOpacity>
        ) : (
          medications.map(med => (
            <View key={med.id} style={[
              styles.medCard,
              takenMeds[med.id] === true  && styles.medCardTaken,
              takenMeds[med.id] === false && styles.medCardMissed,
            ]}>
              <View style={styles.medIcon}><Text>💊</Text></View>
              <View style={styles.medInfo}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medDetails}>{med.dosage} · {med.times?.[0]}</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                // @ts-ignore
                onPress={() => router.push({
                  pathname: '/edit-medication',
                  params: {
                    id: med.id,
                    name: med.name,
                    dosage: med.dosage,
                    form: med.form,
                    frequency: med.frequency,
                    notes: med.notes ?? '',
                  },
                })}
              >
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(med.id, med.name, med.notificationIds ?? [])}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.checkButton, takenMeds[med.id] && styles.checkButtonDone]}
                onPress={() => handleMarkTaken(med.id)}
              >
                {takenMeds[med.id] && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={profileMenuVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileMenuVisible(false)}
        >
          <View style={styles.profileMenu}>
            <Text style={styles.profileName}>
              {auth.currentUser?.displayName || 'User'}
            </Text>
            <Text style={styles.profileEmail}>
              {auth.currentUser?.email || 'No email available'}
            </Text>

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              // @ts-ignore
              onPress={() => {
                setProfileMenuVisible(false);
                router.push('/adherence');
              }}
            >
              <Text style={styles.menuText}>Adherence Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              // @ts-ignore
              onPress={() => {
                setProfileMenuVisible(false);
                router.push('/add-medication');
              }}
            >
              <Text style={styles.menuText}>Manage Medications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              // @ts-ignore
              onPress={() => {
                setProfileMenuVisible(false);
                router.push('/set-reminders');
              }}
            >
              <Text style={styles.menuText}>Set Reminders</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          // @ts-ignore
          onPress={() => router.push('/add-medication')}
        >
          <Text style={styles.navIcon}>💊</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          // @ts-ignore
          onPress={() => router.push('/adherence')}
        >
          <Text style={styles.navIcon}>📈</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setProfileMenuVisible(true)}
        >
          <Text style={styles.navIcon}>👤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  scroll: { padding: 20, gap: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 16, color: '#666' },
  userName: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  settingsText: { fontSize: 22, padding: 8 },
  progressCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  progressBarBg: { height: 10, backgroundColor: '#f0f0f0', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#1a1a1a', borderRadius: 5 },
  progressCount: { fontSize: 14, color: '#666', textAlign: 'right' },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressStatTaken: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
  progressStatMissed: { fontSize: 13, fontWeight: '600', color: '#ef4444' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 1 },
  loadingText: { color: '#999', textAlign: 'center', marginTop: 20 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 30,
    alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed',
  },
  emptyText: { color: '#999', fontSize: 16 },
  medCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  medCardTaken:  { borderLeftWidth: 4, borderLeftColor: '#22c55e' },
  medCardMissed: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  medIcon: {
    width: 44, height: 44, backgroundColor: '#f5f5f5',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  medInfo: { flex: 1 },
  medName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  medDetails: { fontSize: 13, color: '#888', marginTop: 2 },
  checkButton: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center',
  },
  checkButtonDone: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  checkMark: { color: '#fff', fontWeight: 'bold' },
  editButton: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  editIcon: { fontSize: 16 },
  deleteButton: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteIcon: { fontSize: 16 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eee',
  },
  navItem: { padding: 8 },
  navIcon: { fontSize: 22 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  profileMenu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  logoutItem: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});