import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Mock data for the Activity Mastery
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
  { date: 'Sep 28', title: 'Mastered: Kitchen Tools', type: 'module' },
];

// Generates an array of 30 days of mock XP data matching the visual style of the reference image
const generateBarData = () => {
  return Array.from({ length: 30 }).map((_, i) => {
    // Generate some random spikes
    if (i === 5 || i === 7 || i === 9) return Math.floor(Math.random() * 400) + 200;
    if (i === 22) return 500;
    if (i === 28) return 1850; // The massive spike near the end
    return 0;
  });
};

export default function StatsScreen() {
  const [firstName, setFirstName] = useState('');
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [xpData] = useState(generateBarData());

  // Dynamic Calendar Setup
  const todayDate = new Date();
  const currentDay = todayDate.getDate();
  const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).getDay(); // 0 is Sunday
  
  // Pad the beginning of the grid with nulls to align the days of the week correctly
  const calendarDays = Array(firstDay).fill(null).concat([...Array(daysInMonth).keys()].map(n => n + 1));

  // Simulates a streak leading up to today
const isStreakDay = (day: number | null) => day !== null && day < currentDay && day >= currentDay - streak;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('students')
            .select('first_name, xp, streak')
            .eq('id', user.id)
            .single();

          if (profile) {
            setFirstName(profile.first_name);
            setXp(profile.xp || 3200);
            setStreak(profile.streak || 5);
          }
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>
        
        {/* HEADER SECTION */}
        <View style={styles.topSection}>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* THE NEW MONTHLY STREAKS CARD */}
          <View style={styles.streakCard}>
            <Text style={styles.streakCardTitle}>Streaks</Text>
            
            <View style={styles.streakStatsRow}>
              <View style={styles.streakStatBlock}>
                <Text style={styles.streakStatValue}>{streak} days</Text>
                <Text style={styles.streakStatLabel}>Total</Text>
              </View>
              <View style={[styles.streakStatBlock, { alignItems: 'flex-end' }]}>
                <Text style={styles.streakStatValue}>0 freezes</Text>
                <Text style={styles.streakStatLabel}>Left</Text>
              </View>
            </View>

            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`header-${index}`} style={styles.calendarHeader}>{day}</Text>
              ))}
              
              {calendarDays.map((day, index) => (
                <View key={`cell-${index}`} style={styles.calendarCell}>
                  {day ? (
                    <View style={[
                      styles.calendarDay,
                      isStreakDay(day) && styles.calendarDayStreak,
                      day === currentDay && styles.calendarDayActive
                    ]}>
                      <Text style={[
                        styles.calendarDayText,
                        isStreakDay(day) && styles.calendarDayTextStreak,
                        day === currentDay && styles.calendarDayTextActive
                      ]}>
                        {day}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {/* THE NEW EXPERIENCE POINTS BAR GRAPH */}
          <View style={styles.xpCard}>
            <Text style={styles.xpCardTitle}>Experience Points</Text>
            
            <View style={styles.xpStatsRow}>
              <View>
                <Text style={styles.xpStatValue}>3,200 XP</Text>
                <Text style={styles.xpStatLabel}>Last 30 days</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.xpStatValue}>0 XP</Text>
                <Text style={styles.xpStatLabel}>Today</Text>
              </View>
            </View>

            <View style={styles.graphContainer}>
              {/* Background Grid Lines */}
              <View style={styles.graphGrid}>
                {['1900', '1520', '1140', '760', '380', ''].map((val, idx) => (
                  <View key={idx} style={styles.graphRow}>
                    <Text style={styles.graphYLabel}>{val}</Text>
                    <View style={styles.graphDashedLine} />
                  </View>
                ))}
              </View>
              
              {/* Foreground Green Bars */}
              <View style={styles.graphBars}>
                {xpData.map((val, idx) => (
                  <View key={idx} style={styles.barContainer}>
                    {val > 0 && <View style={[styles.barFill, { height: `${(val / 1900) * 100}%` }]} />}
                  </View>
                ))}
              </View>
            </View>

            {/* X-Axis Labels */}
            <View style={styles.graphXAxis}>
              <Text style={styles.graphXLabel}>06 September</Text>
              <Text style={styles.graphXLabel}>Today</Text>
            </View>
          </View>

          {/* SECONDARY STATS (Tier) */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="trophy" size={24} color="#2e64e5" />
              <Text style={styles.statValue}>Gold</Text>
              <Text style={styles.statLabel}>Current Tier</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
              <Text style={styles.statValue}>82%</Text>
              <Text style={styles.statLabel}>Avg Accuracy</Text>
            </View>
          </View>

          {/* SECTION: ACCURACY BARS */}
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

          {/* SECTION: TIMELINE */}
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
  
  // Custom Monthly Streaks Card
  streakCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 25, marginBottom: 15, marginTop: 20, zIndex: 2, borderWidth: 1, borderColor: '#d0ddff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5 },
  streakCardTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  streakStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  streakStatBlock: { flex: 1 },
  streakStatValue: { fontSize: 26, fontWeight: 'bold', color: '#333' },
  streakStatLabel: { fontSize: 14, color: '#aaa', fontWeight: '500', marginTop: 2 },
  
  // Calendar Grid
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15 },
  calendarHeader: { width: `${100/7}%`, textAlign: 'center', fontSize: 12, color: '#aaa', fontWeight: 'bold', marginBottom: 10 },
  calendarCell: { width: `${100/7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  calendarDay: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  calendarDayText: { fontSize: 14, color: '#666', fontWeight: '500' },
  calendarDayStreak: { backgroundColor: '#ff9800' }, 
  calendarDayTextStreak: { color: '#ffffff', fontWeight: 'bold' },
  calendarDayActive: { borderWidth: 2, borderColor: '#fbc02d', backgroundColor: '#fffdf5' },
  calendarDayTextActive: { color: '#fbc02d', fontWeight: 'bold' },

  // Experience Points Bar Graph Card
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
  barFill: { width: 6, backgroundColor: '#00e676', borderRadius: 3 }, // Matching the vibrant green from the image
  
  graphXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 45, marginTop: 10 },
  graphXLabel: { fontSize: 12, color: '#aaa', fontWeight: '500' },

  // Secondary Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 15, alignItems: 'center', marginHorizontal: 5, borderWidth: 1, borderColor: '#d0ddff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '500' },

  sectionContainer: { marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  sectionDescription: { fontSize: 13, color: '#666', marginBottom: 12 },

  cardContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d0ddff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },

  // Activity Mastery Bars
  masteryWrapper: { marginBottom: 15 },
  masteryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  masteryLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  masteryPercentage: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  masteryBackground: { height: 10, backgroundColor: '#e0e8f9', borderRadius: 5, overflow: 'hidden' },
  masteryFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 5 },

  // Timeline
  timelineRow: { flexDirection: 'row', minHeight: 60 },
  timelineGraphics: { width: 30, alignItems: 'center' },
  timelineNode: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#a0b9c1', zIndex: 2, marginTop: 4 },
  timelineNodeAccent: { backgroundColor: '#ff9800', width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#d0ddff', position: 'absolute', top: 18, bottom: -4 },
  timelineContent: { flex: 1, paddingLeft: 10, paddingBottom: 25 },
  timelineDate: { fontSize: 12, color: '#aaa', fontWeight: 'bold', marginBottom: 2 },
  timelineItemTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
});