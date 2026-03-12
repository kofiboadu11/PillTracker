import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, TouchableOpacity, TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getMedicationHistory } from '../firebase/medications';

type FilterMode = 'all' | 'taken' | 'missed';

type HistoryEntry = { medId: string; name: string; dosage: string; taken: boolean };
type HistoryDay   = { date: string; entries: HistoryEntry[] };

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function AdherenceScreen() {
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<FilterMode>('all');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        try {
          const data = await getMedicationHistory(30);
          setHistory(data);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [])
  );

  const totalEntries  = history.reduce((sum, d) => sum + d.entries.length, 0);
  const takenEntries  = history.reduce((sum, d) => sum + d.entries.filter(e => e.taken).length, 0);
  const adherenceRate = totalEntries > 0 ? Math.round((takenEntries / totalEntries) * 100) : 0;

  // Apply search + filter
  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history
      .map(day => ({
        ...day,
        entries: day.entries.filter(e => {
          const matchesSearch = q === '' || e.name.toLowerCase().includes(q);
          const matchesFilter =
            filter === 'all'    ? true :
            filter === 'taken'  ? e.taken :
            /* missed */          !e.taken;
          return matchesSearch && matchesFilter;
        }),
      }))
      .filter(day => day.entries.length > 0);
  }, [history, search, filter]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📋 History</Text>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search medication..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* ── Filter pills ── */}
        <View style={styles.filterRow}>
          {(['all', 'taken', 'missed'] as FilterMode[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
                {f === 'all' ? 'All' : f === 'taken' ? '✓ Taken' : '✗ Missed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 30-day Summary Card ── */}
        {!loading && totalEntries > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>30-Day Adherence</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{adherenceRate}%</Text>
                <Text style={styles.summaryLabel}>Rate</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{takenEntries}</Text>
                <Text style={styles.summaryLabel}>Taken</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalEntries - takenEntries}</Text>
                <Text style={styles.summaryLabel}>Missed</Text>
              </View>
            </View>
            {/* Adherence bar */}
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${adherenceRate}%` }]} />
            </View>
          </View>
        )}

        {/* ── Loading ── */}
        {loading && (
          <ActivityIndicator size="large" color="#1a1a1a" style={{ marginTop: 40 }} />
        )}

        {/* ── Empty State ── */}
        {!loading && history.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💊</Text>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyText}>
              Start marking medications as taken on the dashboard to see your history here.
            </Text>
          </View>
        )}

        {/* ── No results from search/filter ── */}
        {!loading && history.length > 0 && filteredHistory.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>
              Try a different search term or filter.
            </Text>
          </View>
        )}

        {/* ── Daily Log ── */}
        {!loading && filteredHistory.map(day => {
          const dayTaken  = day.entries.filter(e => e.taken).length;
          const dayTotal  = day.entries.length;
          const allTaken  = dayTaken === dayTotal;
          const noneTaken = dayTaken === 0;

          return (
            <View key={day.date} style={styles.dayBlock}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{formatDate(day.date)}</Text>
                <View style={[
                  styles.dayBadge,
                  allTaken ? styles.badgeGreen : noneTaken ? styles.badgeRed : styles.badgeYellow
                ]}>
                  <Text style={styles.dayBadgeText}>{dayTaken}/{dayTotal}</Text>
                </View>
              </View>

              {day.entries.map((entry, i) => (
                <View key={`${entry.medId}-${i}`} style={styles.entryRow}>
                  <View style={[styles.statusDot, entry.taken ? styles.dotGreen : styles.dotRed]} />
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    {entry.dosage ? (
                      <Text style={styles.entryDosage}>{entry.dosage}</Text>
                    ) : null}
                  </View>
                  <Text style={entry.taken ? styles.takenLabel : styles.missedLabel}>
                    {entry.taken ? '✓ Taken' : '✗ Missed'}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, color: '#555' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },

  summaryCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, gap: 14,
  },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: '#aaa' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  summaryLabel: { fontSize: 12, color: '#888' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#333' },
  barBg: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 3 },

  emptyCard: { alignItems: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },

  dayBlock: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  dayBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeGreen: { backgroundColor: '#dcfce7' },
  badgeYellow: { backgroundColor: '#fef9c3' },
  badgeRed: { backgroundColor: '#fee2e2' },
  dayBadgeText: { fontSize: 12, fontWeight: '600', color: '#333' },

  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#22c55e' },
  dotRed: { backgroundColor: '#ef4444' },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  entryDosage: { fontSize: 12, color: '#999' },
  takenLabel: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
  missedLabel: { fontSize: 13, fontWeight: '600', color: '#ef4444' },

  // Search & filter
  searchRow: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, borderWidth: 1, borderColor: '#eee',
  },
  searchInput: { fontSize: 15, color: '#1a1a1a' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterPillActive: { backgroundColor: '#1a1a1a' },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterPillTextActive: { color: '#fff' },
});
