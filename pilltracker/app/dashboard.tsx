import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Modal,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { getMedications, toggleMedication, getAdherenceForDate, deleteMedication, initializeTodayAdherence } from '../firebase/medications';
import { cancelMedNotifications } from '../utils/notifications';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

// ─── Skeleton Pulse ───────────────────────────────────────────────────────────
function SkeletonPulse({ style }: { style: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]} />;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <SkeletonPulse style={skeletonStyles.icon} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonPulse style={skeletonStyles.lineWide} />
        <SkeletonPulse style={skeletonStyles.lineNarrow} />
      </View>
      <SkeletonPulse style={skeletonStyles.circle} />
    </View>
  );
}

// ─── Swipeable Med Card ───────────────────────────────────────────────────────
function SwipeableMedCard({
  med, taken, onToggle, onEdit, onDelete,
}: {
  med: any;
  taken: boolean | undefined;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const slideIn    = useRef(new Animated.Value(30)).current;
  const fadeIn     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideIn,  { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 0 }}>
      {/* Delete hint revealed underneath */}
      <View style={styles.deleteHint}>
        <Text style={styles.deleteHintText}>🗑️  Delete</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], opacity: fadeIn, translateY: slideIn }}
        {...panResponder.panHandlers}
      >
        <View style={[
          styles.medCard,
          taken === true  && styles.medCardTaken,
          taken === false && styles.medCardMissed,
        ]}>
          <View style={styles.medIcon}><Text>💊</Text></View>
          <View style={styles.medInfo}>
            <Text style={styles.medName}>{med.name}</Text>
            <Text style={styles.medDetails}>{med.dosage} · {med.times?.[0]}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkButton, taken && styles.checkButtonDone]}
            onPress={onToggle}
          >
            {taken && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

export default function DashboardScreen() {
  const [medications, setMedications] = useState<any[]>([]);
  const [takenMeds, setTakenMeds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  // Screen entrance animation
  const screenFade  = useRef(new Animated.Value(0)).current;
  const screenSlide = useRef(new Animated.Value(24)).current;

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  const userName = auth.currentUser?.displayName?.split(' ')[0] || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useFocusEffect(
    useCallback(() => {
      // Entrance animation on every focus
      screenFade.setValue(0);
      screenSlide.setValue(24);
      Animated.parallel([
        Animated.timing(screenFade,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(screenSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();

      const loadData = async () => {
        try {
          const meds = await getMedications();
          setMedications(meds);

          const today = new Date().toISOString().split('T')[0];
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
      // Haptic feedback
      if (newValue) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              if (notificationIds.length > 0) {
                await cancelMedNotifications(notificationIds);
              }
              await deleteMedication(medId);
              setMedications(prev => prev.filter(m => m.id !== medId));
              // Also remove from takenMeds so progress bar updates correctly
              setTakenMeds(prev => {
                const updated = { ...prev };
                delete updated[medId];
                return updated;
              });
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

  // Calculate today's counts (explicit true/false checks to avoid undefined)
  const takenCount = medications.filter(m => takenMeds[m.id] === true).length;
  const missedCount = medications.filter(m => takenMeds[m.id] === false).length;
  const totalCount = medications.length;
  const progressPercent = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;

  // Animate progress bar whenever percent changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: screenFade, transform: [{ translateY: screenSlide }] }}>
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
            <Animated.View style={[
              styles.progressBarFill,
              { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
            ]} />
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
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
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
            <SwipeableMedCard
              key={med.id}
              med={med}
              taken={takenMeds[med.id]}
              onToggle={() => handleMarkTaken(med.id)}
              onEdit={() => router.push({
                // @ts-ignore
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
              onDelete={() => handleDelete(med.id, med.name, med.notificationIds ?? [])}
            />
          ))
        )}
      </ScrollView>
      </Animated.View>

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
  deleteHint: {
    position: 'absolute', top: 0, bottom: 0, right: 0, left: 0,
    backgroundColor: '#ef4444', borderRadius: 16,
    justifyContent: 'center', alignItems: 'flex-end', paddingRight: 24,
  },
  deleteHintText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  icon:        { width: 44, height: 44, borderRadius: 12, backgroundColor: '#e5e7eb' },
  lineWide:    { height: 14, borderRadius: 6, backgroundColor: '#e5e7eb', width: '70%' },
  lineNarrow:  { height: 11, borderRadius: 6, backgroundColor: '#e5e7eb', width: '45%' },
  circle:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb' },
});