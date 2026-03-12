import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getMedicationHistory } from '../firebase/medications';

type FilterMode  = 'all' | 'taken' | 'missed';
type ViewMode    = 'list' | 'calendar';

type HistoryEntry = { medId: string; name: string; dosage: string; taken: boolean };
type HistoryDay   = { date: string; entries: HistoryEntry[] };

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_SIZE     = Math.floor((SCREEN_WIDTH - 40 - 12 * 6) / 7); // 40px padding, 6 gaps

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

// Build a map of dateStr -> { taken, total }
const buildDayMap = (history: HistoryDay[]) => {
  const map: Record<string, { taken: number; total: number }> = {};
  for (const day of history) {
    map[day.date] = {
      taken: day.entries.filter(e => e.taken).length,
      total: day.entries.length,
    };
  }
  return map;
};

// Returns all calendar cells for a given year/month (with leading nulls for offset)
const getCalendarCells = (year: number, month: number): (number | null)[] => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

const pad = (n: number) => String(n).padStart(2, '0');

// dot color for a calendar day
const dotColor = (taken: number, total: number): string => {
  if (taken === total) return '#22c55e';   // all taken  → green
  if (taken === 0)     return '#ef4444';   // all missed → red
  return '#f59e0b';                        // partial    → amber
};

export default function AdherenceScreen() {
  const [history, setHistory]       = useState<HistoryDay[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<FilterMode>('all');
  const [viewMode, setViewMode]     = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar navigation state
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());  // 0-indexed

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

  // Calendar derived values
  const dayMap       = useMemo(() => buildDayMap(history), [history]);
  const calCells     = useMemo(() => getCalendarCells(calYear, calMonth), [calYear, calMonth]);
  const calMonthName = new Date(calYear, calMonth, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const selectedDayData = selectedDate
    ? history.find(d => d.date === selectedDate) ?? null
    : null;

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📋 History</Text>
          {/* View toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Text style={[styles.toggleBtnText, viewMode === 'list' && styles.toggleBtnTextActive]}>
                ☰ List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
              onPress={() => setViewMode('calendar')}
            >
              <Text style={[styles.toggleBtnText, viewMode === 'calendar' && styles.toggleBtnTextActive]}>
                📅 Cal
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 30-day Summary Card (always visible) ── */}
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
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${adherenceRate}%` }]} />
            </View>
          </View>
        )}

        {/* ── Loading ── */}
        {loading && (
          <ActivityIndicator size="large" color="#1a1a1a" style={{ marginTop: 40 }} />
        )}

        {/* ════════════════════════════════════
            CALENDAR VIEW
        ════════════════════════════════════ */}
        {!loading && viewMode === 'calendar' && (
          <View style={styles.calendarCard}>

            {/* Month nav */}
            <View style={styles.calNavRow}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>{calMonthName}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.calWeekRow}>
              {WEEKDAYS.map(d => (
                <Text key={d} style={styles.calWeekDay}>{d}</Text>
              ))}
            </View>

            {/* Day cells */}
            <View style={styles.calGrid}>
              {calCells.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.calCell} />;
                }
                const dateStr  = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
                const data     = dayMap[dateStr];
                const isToday  = dateStr === `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                const isSelected = dateStr === selectedDate;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.calCell,
                      isToday    && styles.calCellToday,
                      isSelected && styles.calCellSelected,
                    ]}
                    onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calDayNum,
                      isToday    && styles.calDayNumToday,
                      isSelected && styles.calDayNumSelected,
                    ]}>
                      {day}
                    </Text>
                    {data && (
                      <View style={[styles.calDot, { backgroundColor: dotColor(data.taken, data.total) }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.calLegend}>
              {[['#22c55e', 'All taken'], ['#f59e0b', 'Partial'], ['#ef4444', 'Missed']].map(([c, l]) => (
                <View key={l} style={styles.calLegendItem}>
                  <View style={[styles.calLegendDot, { backgroundColor: c }]} />
                  <Text style={styles.calLegendText}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Selected day detail (calendar view) ── */}
        {!loading && viewMode === 'calendar' && selectedDate && (
          <View style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{formatDate(selectedDate)}</Text>
              {selectedDayData ? (
                <View style={[
                  styles.dayBadge,
                  selectedDayData.entries.every(e => e.taken)  ? styles.badgeGreen :
                  selectedDayData.entries.every(e => !e.taken) ? styles.badgeRed   : styles.badgeYellow
                ]}>
                  <Text style={styles.dayBadgeText}>
                    {selectedDayData.entries.filter(e => e.taken).length}/{selectedDayData.entries.length}
                  </Text>
                </View>
              ) : null}
            </View>
            {selectedDayData ? selectedDayData.entries.map((entry, i) => (
              <View key={`${entry.medId}-${i}`} style={styles.entryRow}>
                <View style={[styles.statusDot, entry.taken ? styles.dotGreen : styles.dotRed]} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  {entry.dosage ? <Text style={styles.entryDosage}>{entry.dosage}</Text> : null}
                </View>
                <Text style={entry.taken ? styles.takenLabel : styles.missedLabel}>
                  {entry.taken ? '✓ Taken' : '✗ Missed'}
                </Text>
              </View>
            )) : (
              <Text style={styles.calNoData}>No data for this day.</Text>
            )}
          </View>
        )}

        {/* ════════════════════════════════════
            LIST VIEW
        ════════════════════════════════════ */}
        {!loading && viewMode === 'list' && (
          <>
            {/* Search bar */}
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

            {/* Filter pills */}
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

            {/* Empty state */}
            {history.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>💊</Text>
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.emptyText}>
                  Start marking medications as taken on the dashboard to see your history here.
                </Text>
              </View>
            )}

            {/* No results */}
            {history.length > 0 && filteredHistory.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptyText}>Try a different search term or filter.</Text>
              </View>
            )}

            {/* Daily log */}
            {filteredHistory.map(day => {
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
                        {entry.dosage ? <Text style={styles.entryDosage}>{entry.dosage}</Text> : null}
                      </View>
                      <Text style={entry.taken ? styles.takenLabel : styles.missedLabel}>
                        {entry.taken ? '✓ Taken' : '✗ Missed'}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}

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

  // View toggle (List / Calendar)
  viewToggle: {
    flexDirection: 'row', marginLeft: 'auto',
    backgroundColor: '#f0f0f0', borderRadius: 10, padding: 2,
  },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#1a1a1a' },
  toggleBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  toggleBtnTextActive: { color: '#fff' },

  // Calendar card
  calendarCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, gap: 12,
  },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { padding: 8 },
  calNavText: { fontSize: 22, color: '#1a1a1a', fontWeight: '600' },
  calMonthLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  calWeekDay: { width: DAY_SIZE, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#999' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calCell: {
    width: DAY_SIZE, height: DAY_SIZE + 8,
    alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 3,
  },
  calCellToday: { backgroundColor: '#f0f0f0' },
  calCellSelected: { backgroundColor: '#1a1a1a' },
  calDayNum: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  calDayNumToday: { color: '#1a1a1a' },
  calDayNumSelected: { color: '#fff' },
  calDot: { width: 6, height: 6, borderRadius: 3 },
  calLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calLegendText: { fontSize: 11, color: '#888' },
  calNoData: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 8 },
});
