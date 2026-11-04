import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Keep dummy data for areas you haven't built DB tables for yet
const accuracyData = [
  { type: 'Multiple Choice', percentage: 85 },
  { type: 'Drag & Drop', percentage: 92 },
  { type: 'Matching', percentage: 78 },
  { type: 'True / False', percentage: 88 },
  { type: 'Fill in Blanks', percentage: 65 },
];

const timelineData = [
  { date: 'Oct 05', title: 'Mastered: Food Safety Basics', type: 'module' },
  { date: 'Oct 02', title: '7-Day Streak Achieved!', type: 'milestone' },
];

// Formats a local Date object to 'YYYY-MM-DD' reliably across Android/iOS (avoids Hermes locale bugs)
const formatLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Normalizes any Supabase date/timestamp string into 'YYYY-MM-DD'
const normalizeLogDateKey = (rawDate: string): string => {
  if (!rawDate) return '';
  const trimmed = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return formatLocalDateKey(parsed);
  }
  return trimmed.slice(0, 10);
};

// Exact calendar-day difference between two 'YYYY-MM-DD' strings (0 = today, 1 = yesterday, etc.)
const diffCalendarDays = (todayKey: string, targetKey: string): number => {
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const [ly, lm, ld] = targetKey.split('-').map(Number);
  const utcToday = Date.UTC(ty, (tm || 1) - 1, td || 1);
  const utcTarget = Date.UTC(ly, (lm || 1) - 1, ld || 1);
  return Math.round((utcToday - utcTarget) / (1000 * 60 * 60 * 24));
};

// Returns 'YYYY-MM-DD' for N days before the given 'YYYY-MM-DD'
const subtractDaysFromKey = (baseKey: string, daysToSubtract: number): string => {
  const [y, m, d] = baseKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) - daysToSubtract));
  const ry = dt.getUTCFullYear();
  const rm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const rd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
};

export default function StatsScreen() {
  const [firstName, setFirstName] = useState('');
  const [totalXp, setTotalXp] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState(82);
  const [activeMonthDays, setActiveMonthDays] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [xpData, setXpData] = useState<number[]>(Array(30).fill(0));

  // Date calculations for current month calendar
  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();
  const currentDay = todayDate.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = Array(firstDay).fill(null).concat([...Array(daysInMonth).keys()].map(n => n + 1));

  // A day is marked on the calendar if XP/lesson activity was logged on that date OR it falls inside the active streak window
  const hasTodayActivity = activeMonthDays.includes(currentDay) || todayXp > 0;
  const isStreakDay = (day: number | null) => {
    if (day === null || day > currentDay) return false;
    if (activeMonthDays.includes(day)) return true;
    if (streak <= 0) return false;
    const endDay = hasTodayActivity ? currentDay : currentDay - 1;
    return day <= endDay && day > endDay - streak;
  };

  const fetchStats = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch overall profile stats
      const { data: profile } = await supabase
        .from('students')
        .select('first_name, xp, streak')
        .eq('id', user.id)
        .single();

      const profileXp = Number(profile?.xp) || 0;
      const profileStreak = Number(profile?.streak) || 0;

      if (profile) {
        setFirstName(profile.first_name || '');
      }

      // 2. Fetch the last 60 days of XP logs (covers 30-day graph + full month calendar + streak calculation)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const dateString = formatLocalDateKey(sixtyDaysAgo);

      const { data: logs } = await supabase
        .from('xp_logs')
        .select('earned_date, xp_gained')
        .eq('student_id', user.id)
        .gte('earned_date', dateString)
        .order('earned_date', { ascending: true });

      // 3. Aggregate XP per calendar date ('YYYY-MM-DD')
      const todayKey = formatLocalDateKey(new Date());
      const dailyXpMap = new Map<string, number>();
      let completedCount = 0;

      if (logs && logs.length > 0) {
        logs.forEach((log: any) => {
          const gained = Number(log.xp_gained) || 0;
          if (gained <= 0) return;
          const key = normalizeLogDateKey(log.earned_date);
          if (!key) return;
          dailyXpMap.set(key, (dailyXpMap.get(key) || 0) + gained);
          completedCount += 1;
        });
      }

      // 4. Map aggregated daily XP to the 30-day bar chart (index 29 = Today, index 0 = 29 days ago)
      const newXpData = Array(30).fill(0);
      dailyXpMap.forEach((dayXp, dateKey) => {
        const diffDays = diffCalendarDays(todayKey, dateKey);
        const index = 29 - diffDays;
        if (index >= 0 && index < 30) {
          newXpData[index] += dayXp;
        }
      });

      const todayEarned = newXpData[29] || 0;

      // 5. Find all active days in the current calendar month so they highlight on the calendar
      const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
      const monthActiveDays: number[] = [];
      dailyXpMap.forEach((dayXp, dateKey) => {
        if (dayXp > 0 && dateKey.startsWith(currentMonthPrefix)) {
          const dayNum = Number(dateKey.slice(8, 10));
          if (!isNaN(dayNum)) monthActiveDays.push(dayNum);
        }
      });

      // 6. Calculate consecutive daily streak from activity logs
      let computedStreak = 0;
      const startOffset = (dailyXpMap.get(todayKey) || 0) > 0 ? 0 : 1;
      for (let offset = startOffset; offset < 60; offset++) {
        const checkKey = subtractDaysFromKey(todayKey, offset);
        if ((dailyXpMap.get(checkKey) || 0) > 0) {
          computedStreak += 1;
        } else {
          break;
        }
      }

      const effectiveStreak =
        computedStreak > 0
          ? Math.max(computedStreak, profileStreak)
          : todayEarned > 0
          ? Math.max(1, profileStreak)
          : profileStreak;

      // Keep Supabase student streak in sync if a new streak day was earned
      if (effectiveStreak > profileStreak) {
        await supabase
          .from('students')
          .update({ streak: effectiveStreak })
          .eq('id', user.id);
      }

      // 7. Fetch quiz grades to compute real Avg Accuracy and supplement completed count
      const { data: grades } = await supabase
        .from('quiz_grades')
        .select('score, total_items')
        .eq('student_id', user.id);

      if (grades && grades.length > 0) {
        let totalScore = 0;
        let totalItems = 0;
        grades.forEach((g: any) => {
          totalScore += Number(g.score) || 0;
          totalItems += Number(g.total_items) || 0;
        });
        if (totalItems > 0) {
          setAvgAccuracy(Math.round((totalScore / totalItems) * 100));
        }
        completedCount = Math.max(completedCount, grades.length);
      }

      // Estimate lessons completed from total XP if xp_logs only has recent rows (50 XP per lesson)
      const estimatedFromXp = Math.floor(profileXp / 50);
      setLessonsCompleted(Math.max(completedCount, estimatedFromXp));

      setTotalXp(profileXp);
      setTodayXp(todayEarned);
      setStreak(effectiveStreak);
      setActiveMonthDays(monthActiveDays);
      setXpData(newXpData);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refresh analytics automatically whenever the user switches to the Stats tab
  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
      </View>
    );
  }

  // Find the highest XP day to scale the graph bars dynamically
  const maxBarXp = Math.max(...xpData, 100);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>

        <View style={styles.topSection}>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* STREAKS CARD */}
          <View style={styles.streakCard}>
            <Text style={styles.streakCardTitle}>Streaks</Text>
            <View style={styles.streakStatsRow}>
              <View style={styles.streakStatBlock}>
                <Text style={styles.streakStatValue}>
                  {streak} {streak === 1 ? 'day' : 'days'}
                </Text>
                <Text style={styles.streakStatLabel}>Current Streak</Text>
              </View>
            </View>

            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`header-${index}`} style={styles.calendarHeader}>{day}</Text>
              ))}

              {calendarDays.map((day, index) => {
                const markedAsStreak = isStreakDay(day);
                const isToday = day === currentDay;

                return (
                  <View key={`cell-${index}`} style={styles.calendarCell}>
                    {day ? (
                      <View style={[
                        styles.calendarDay,
                        isToday && !markedAsStreak && styles.calendarDayActive,
                        markedAsStreak && styles.calendarDayStreak,
                        isToday && markedAsStreak && styles.calendarDayStreakToday,
                      ]}>
                        <Text style={[
                          styles.calendarDayText,
                          isToday && !markedAsStreak && styles.calendarDayTextActive,
                          markedAsStreak && styles.calendarDayTextStreak,
                        ]}>
                          {day}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          {/* XP BAR GRAPH CARD */}
          <View style={styles.xpCard}>
            <Text style={styles.xpCardTitle}>Experience Points</Text>

            <View style={styles.xpStatsRow}>
              <View>
                <Text style={styles.xpStatValue}>{totalXp.toLocaleString()} XP</Text>
                <Text style={styles.xpStatLabel}>Total XP</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.xpStatValue, todayXp > 0 && { color: '#00c853' }]}>
                  +{todayXp.toLocaleString()} XP
                </Text>
                <Text style={styles.xpStatLabel}>Today</Text>
              </View>
            </View>

            <View style={styles.graphContainer}>
              <View style={styles.graphGrid}>
                {/* Dynamically scale Y axis based on user's best day */}
                {[maxBarXp, Math.round(maxBarXp * 0.75), Math.round(maxBarXp * 0.5), Math.round(maxBarXp * 0.25), ''].map((val, idx) => (
                  <View key={idx} style={styles.graphRow}>
                    <Text style={styles.graphYLabel}>{val}</Text>
                    <View style={styles.graphDashedLine} />
                  </View>
                ))}
              </View>

              <View style={styles.graphBars}>
                {xpData.map((val, idx) => (
                  <View key={idx} style={styles.barContainer}>
                    {val > 0 && (
                      <View
                        style={[
                          styles.barFill,
                          idx === 29 && styles.barFillToday,
                          { height: `${Math.min((val / maxBarXp) * 100, 100)}%` },
                        ]}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.graphXAxis}>
              <Text style={styles.graphXLabel}>30 Days Ago</Text>
              <Text style={styles.graphXLabel}>Today</Text>
            </View>
          </View>

          {/* SECONDARY STATS (Replaced Gold Tier with Lessons Completed) */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="book" size={24} color="#2e64e5" />
              <Text style={styles.statValue}>{lessonsCompleted}</Text>
              <Text style={styles.statLabel}>Lessons Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
              <Text style={styles.statValue}>{avgAccuracy}%</Text>
              <Text style={styles.statLabel}>Avg Accuracy</Text>
            </View>
          </View>

          {/* ACTIVITY MASTERY */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Activity Mastery</Text>
            <Text style={styles.sectionDescription}>Your average accuracy across different mechanics.</Text>
            <View style={styles.cardContainer}>
              {accuracyData.map((item, index) => (
                <View key={index} style={styles.masteryWrapper}>
                  <View style={styles.masteryHeader}>
                    <Text style={styles.masteryLabel}>{item.type}</Text>
                    <Text style={styles.masteryPercentage}>{item.percentage}%</Text>
                  </View>
                  <View style={styles.masteryBackground}>
                    <View style={[styles.masteryFill, { width: `${item.percentage}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* TIMELINE */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recent Milestones</Text>
            <View style={styles.cardContainer}>
              {timelineData.map((item, index) => (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timelineGraphics}>
                    <View style={[styles.timelineNode, item.type === 'milestone' && styles.timelineNodeAccent]} />
                    {index !== timelineData.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                    <Text style={styles.timelineItemTitle}>{item.title}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2e64e5' },
  mainBackground: { flex: 1, backgroundColor: '#fcfaf8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8' },

  topSection: { backgroundColor: '#2e64e5', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, zIndex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  headerSubtitle: { fontSize: 16, color: '#e0e8f9', marginTop: 4 },

  scrollContent: { paddingBottom: 100, paddingHorizontal: 20 },

  streakCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 25, marginBottom: 15, marginTop: 20, zIndex: 2, borderWidth: 1, borderColor: '#d0ddff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5 },
  streakCardTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  streakStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  streakStatBlock: { flex: 1 },
  streakStatValue: { fontSize: 26, fontWeight: 'bold', color: '#333' },
  streakStatLabel: { fontSize: 14, color: '#aaa', fontWeight: '500', marginTop: 2 },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15 },
  calendarHeader: { width: `${100/7}%`, textAlign: 'center', fontSize: 12, color: '#aaa', fontWeight: 'bold', marginBottom: 10 },
  calendarCell: { width: `${100/7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  calendarDay: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  calendarDayText: { fontSize: 14, color: '#666', fontWeight: '500' },
  calendarDayStreak: { backgroundColor: '#ff9800' },
  calendarDayStreakToday: { borderWidth: 2, borderColor: '#e65100' },
  calendarDayTextStreak: { color: '#ffffff', fontWeight: 'bold' },
  calendarDayActive: { borderWidth: 2, borderColor: '#fbc02d', backgroundColor: '#fffdf5' },
  calendarDayTextActive: { color: '#fbc02d', fontWeight: 'bold' },

  xpCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 25, marginBottom: 30, borderWidth: 1, borderColor: '#d0ddff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5 },
  xpCardTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  xpStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  xpStatValue: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  xpStatLabel: { fontSize: 14, color: '#aaa', fontWeight: '500', marginTop: 2 },

  graphContainer: { height: 180, marginTop: 10, position: 'relative' },
  graphGrid: { flex: 1, justifyContent: 'space-between' },
  graphRow: { flexDirection: 'row', alignItems: 'center' },
  graphYLabel: { width: 40, fontSize: 12, color: '#aaa', transform: [{translateY: -2}] },
  graphDashedLine: { flex: 1, height: 1, borderWidth: 1, borderColor: '#e0e8f9', borderStyle: 'dashed', borderRadius: 1 },

  graphBars: { position: 'absolute', top: 6, bottom: 6, left: 45, right: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barContainer: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barFill: { width: 6, backgroundColor: '#00e676', borderRadius: 3 },
  barFillToday: { width: 8, backgroundColor: '#00c853', borderRadius: 4 },
  
  graphXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 45, marginTop: 10 },
  graphXLabel: { fontSize: 12, color: '#aaa', fontWeight: '500' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 15, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, borderColor: '#d0ddff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '500' },

  sectionContainer: { marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  sectionDescription: { fontSize: 13, color: '#666', marginBottom: 12 },

  cardContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d0ddff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },

  masteryWrapper: { marginBottom: 15 },
  masteryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  masteryLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  masteryPercentage: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  masteryBackground: { height: 10, backgroundColor: '#e0e8f9', borderRadius: 5, overflow: 'hidden' },
  masteryFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 5 },

  timelineRow: { flexDirection: 'row', minHeight: 60 },
  timelineGraphics: { width: 30, alignItems: 'center' },
  timelineNode: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#a0b9c1', zIndex: 2, marginTop: 4 },
  timelineNodeAccent: { backgroundColor: '#ff9800', width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#d0ddff', position: 'absolute', top: 18, bottom: -4 },
  timelineContent: { flex: 1, paddingLeft: 10, paddingBottom: 25 },
  timelineDate: { fontSize: 12, color: '#aaa', fontWeight: 'bold', marginBottom: 2 },
  timelineItemTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
});