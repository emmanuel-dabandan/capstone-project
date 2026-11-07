import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '../lib/ThemeContext'; // THEME HOOK

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.round(width * 0.85);
const CARD_MARGIN = 8;
const ITEM_SIZE = CARD_WIDTH + (CARD_MARGIN * 2);

const CORE_SUBJECTS = [
  'Effective Communication',
  'General Mathematics',
  'General Science',
  'Life and Career Skills',
  'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
];

const getStrandSubjectName = (strand?: string | null) => {
  const s = (strand || '').trim();
  if (!s || s.toLowerCase() === 'explorer') {
    return 'Strand-Based Specialized Subject';
  }
  const upper = s.toUpperCase();
  if (upper === 'CBF' || /cook|food|bak|culinary|beverage/i.test(s)) {
    return 'Cookery, Bakery & Food and Beverages';
  }
  if (upper === 'ICT' || /computer|digital|it|tech/i.test(s)) {
    return 'Information and Communications Technology (ICT)';
  }
  if (upper === 'STEM') return 'STEM Specialized Subject';
  if (upper === 'ABM') return 'ABM Specialized Subject';
  if (upper === 'HUMSS') return 'HUMSS Specialized Subject';
  if (upper === 'GAS') return 'GAS Specialized Subject';
  if (upper === 'TVL') return 'TVL Specialized Subject';
  return s;
};

const getSubjectKey = (title: string) =>
  (title || '').trim().replace(/\s+/g, ' ').toLowerCase();

const buildDefaultSubjects = (strandName?: string | null) => {
  const strandSubject = getStrandSubjectName(strandName);
  const allNames = [...CORE_SUBJECTS, strandSubject];
  return allNames.map((title, idx) => ({
    id: idx + 1,
    title,
    subtitle: 'No modules yet',
    progress: 0,
  }));
};

const ProgressCircle = ({ progress }: { progress: number }) => {
  const size = 70;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const fillAmount = circumference - (progress / 100) * circumference;
  const isZero = progress === 0;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={isZero ? '#00000020' : '#ffffff40'} strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={isZero ? '#000000' : '#ffffff'} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={fillAmount} strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <Text style={[styles.circularProgressText, { opacity: isZero ? 0.5 : 1 }]}>{progress}%</Text>
    </View>
  );
};

export default function DashboardScreen() {
  const { theme } = useAppTheme();
  const [firstName, setFirstName] = useState('');
  const [strand, setStrand] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [learningModules, setLearningModules] = useState(() => buildDefaultSubjects());
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isChallengeDone, setIsChallengeDone] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);

  const infiniteModules = Array(100)
    .fill(learningModules)
    .flat()
    .map((module, index) => ({ ...module, uniqueId: `card-${index}` }));

  const getSecondsUntilPHTMidnight = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const phtNow = new Date(utcMs + (8 * 3600000));
    const phtMidnight = new Date(phtNow);
    phtMidnight.setHours(24, 0, 0, 0);
    return Math.floor((phtMidnight.getTime() - phtNow.getTime()) / 1000);
  };

  useEffect(() => {
    setTimeLeft(getSecondsUntilPHTMidnight());
    const timer = setInterval(() => setTimeLeft(getSecondsUntilPHTMidnight()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 3600) return 'Just now';
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    const days = Math.floor(seconds / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return 'A month ago';
  };

  const markAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    setRecentNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  useFocusEffect(
    useCallback(() => {
      const fetchDashboardData = async () => {
        try {
          let userStrand = '';
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('students')
              .select('first_name, strand, xp, streak, last_challenge_date')
              .eq('id', user.id)
              .single();

            if (profile) {
              userStrand = profile.strand || '';
              setFirstName(profile.first_name);
              setStrand(profile.strand || 'Explorer');
              setXp(profile.xp || 0);
              setStreak(profile.streak || 0);

              const todayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
              setIsChallengeDone(profile.last_challenge_date === todayPHT);

              await supabase.from('students').update({ last_active_date: todayPHT }).eq('id', user.id);
            }

            const { data: notifsData } = await supabase
              .from('notifications')
              .select('*')
              .eq('student_id', user.id)
              .order('created_at', { ascending: false })
              .limit(3);

            if (notifsData) setRecentNotifications(notifsData);
          }

          const baseSubjects = buildDefaultSubjects(userStrand);
          const strandSubjectKey = getSubjectKey(getStrandSubjectName(userStrand));

          const { data: lessonsData } = await supabase
            .from('ai_lessons')
            .select('title, subtitle, progress')
            .order('created_at', { ascending: false });

          if (lessonsData) {
            const mergedModules = baseSubjects.map(subj => {
              const subjKey = getSubjectKey(subj.title);
              const dbMatch = lessonsData.find(l => {
                const lKey = getSubjectKey(l.title);
                if (subjKey === strandSubjectKey && lKey === getSubjectKey('Strand-Based Specialized Subject')) {
                  return true;
                }
                return lKey === subjKey;
              });
              return dbMatch
                ? { ...subj, subtitle: dbMatch.subtitle || 'Current Module', progress: dbMatch.progress || 0 }
                : subj;
            });
            setLearningModules(mergedModules);
          } else {
            setLearningModules(baseSubjects);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDashboardData();
    }, [])
  );

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m remaining`;
  };

  if (isLoading) {
    return <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.headerBg} /></View>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.headerBg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.mainBackground, { backgroundColor: theme.bg }]}>

        <View style={[styles.topSection, { backgroundColor: theme.headerBg }]}>
          <View style={styles.headerBar}>
            <View style={[styles.statPill, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}><Text style={styles.statTextXP}>{xp} XP</Text></View>
            <View style={[styles.statPill, { borderColor: '#ff9800', backgroundColor: '#fff3e0' }]}><Text style={[styles.statText, { color: '#e65100' }]}>{streak} Day Streak</Text></View>
          </View>
          <View style={styles.welcomeContainer}>
            <Text style={styles.greetingText}>Welcome,</Text>
            <Text style={styles.nameText}>{firstName}!</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={[styles.challengeCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <View style={styles.challengeHeader}>
              <View>
                <Text style={[styles.challengeTitle, { color: theme.textPrimary }]}>Daily Challenge</Text>
                <Text style={[styles.challengeSubtitle, { color: theme.textSecondary }]}>Review 3 past concepts</Text>
              </View>
              <View style={[styles.challengeTimerBadge, { backgroundColor: theme.isDark ? '#334155' : '#f0f4ff' }]}>
                <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.timerText, { color: theme.textSecondary }]}>{formatTime(timeLeft)}</Text>
              </View>
            </View>

            <View style={styles.challengeFooter}>
              <View style={styles.rewardPill}>
                <Ionicons name="star" size={14} color="#fbc02d" />
                <Text style={styles.rewardText}>+150 XP</Text>
              </View>
              <TouchableOpacity
                style={[styles.challengeButton, isChallengeDone && styles.challengeButtonDone, theme.isDark && !isChallengeDone && { backgroundColor: '#1d4ed8' }]}
                disabled={isChallengeDone}
                onPress={() => router.push('/gauntlet' as any)}
              >
                <Text style={styles.challengeButtonText}>{isChallengeDone ? 'Completed' : 'Start Challenge'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.carouselContainer}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Your Learning Path</Text>
            <FlatList
              horizontal={true}
              nestedScrollEnabled={true}
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_SIZE}
              snapToAlignment="center"
              decelerationRate="fast"
              disableIntervalMomentum={true}
              contentContainerStyle={styles.carouselContent}
              data={infiniteModules}
              keyExtractor={(item) => item.uniqueId}
              initialScrollIndex={learningModules.length * 50}
              getItemLayout={(_, index) => ({ length: ITEM_SIZE, offset: ITEM_SIZE * index, index })}
              renderItem={({ item: module }) => (
                <View style={[styles.subjectCard, { width: CARD_WIDTH, marginHorizontal: CARD_MARGIN, backgroundColor: theme.isDark ? '#1e3a8a' : '#5480e5' }]}>
                  <View style={styles.cardContentRow}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.subjectTitle} numberOfLines={2}>{module.title}</Text>
                      <Text style={[styles.subjectSubtitle, { color: theme.isDark ? '#94a3b8' : '#a0b9c1' }]} numberOfLines={1}>{module.subtitle}</Text>
                      <TouchableOpacity
                        style={[styles.cardButton, { backgroundColor: theme.isDark ? '#0f172a' : '#fefefe' }]}
                        onPress={() => router.push(`/lesson?subject=${encodeURIComponent(module.title)}` as any)}
                      >
                        <Text style={[styles.cardButtonText, { color: theme.isDark ? '#f8fafc' : '#000000' }]}>
                          {module.progress === 0 ? 'Start Task' : 'View Task'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cardRight}>
                      <ProgressCircle progress={module.progress} />
                    </View>
                  </View>
                </View>
              )}
            />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent Updates</Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.seeAllButton} onPress={() => router.push('/notifications' as any)}>
              <Text style={[styles.seeAllText, { color: theme.isDark ? '#60a5fa' : '#2e64e5' }]}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notificationsOuterContainer}>
            <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              {recentNotifications.length === 0 ? (
                <View style={{ padding: 25, alignItems: 'center' }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>No recent updates.</Text>
                </View>
              ) : (
                recentNotifications.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notificationItem,
                      { borderBottomColor: theme.divider },
                      index === recentNotifications.length - 1 && styles.lastItem
                    ]}
                    activeOpacity={0.6}
                    onPress={() => {
                      markAsRead(item.id, item.is_read);
                      router.push('/notifications' as any);
                    }}
                  >
                    <View style={styles.itemContent}>
                      <Text style={[styles.messageText, { color: theme.textPrimary }, !item.is_read && { fontWeight: 'bold' }]} numberOfLines={2}>
                        {item.message}
                      </Text>

                      <View style={styles.timeRow}>
                        {!item.is_read && <View style={styles.unreadDot} />}
                        <Text style={[styles.timeText, { color: theme.textSecondary }]}>{getTimeAgo(item.created_at)}</Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  mainBackground: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topSection: { paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, zIndex: 1 },
  scrollContent: { paddingBottom: 100, paddingTop: 10 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 25 },
  statPill: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
  statTextXP: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  statText: { fontSize: 14, fontWeight: 'bold' },
  welcomeContainer: { paddingHorizontal: 20 },
  greetingText: { fontSize: 18, color: '#e0e8f9' },
  nameText: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },

  challengeCard: { marginHorizontal: 20, borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 30, marginTop: 0, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, zIndex: 20 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  challengeTitle: { fontSize: 20, fontWeight: 'bold' },
  challengeSubtitle: { fontSize: 13, marginTop: 2 },
  challengeTimerBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  timerText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff9c4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  rewardText: { fontSize: 14, fontWeight: 'bold', color: '#f57f17', marginLeft: 4 },
  challengeButton: { backgroundColor: '#2e64e5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  challengeButtonDone: { backgroundColor: '#4caf50' },
  challengeButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  carouselContainer: { paddingBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 15 },
  carouselContent: { alignItems: 'center' },
  subjectCard: { borderRadius: 24, padding: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  cardContentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { width: '65%', justifyContent: 'center', paddingRight: 15 },
  cardRight: { width: '35%', alignItems: 'flex-end', justifyContent: 'center' },
  subjectTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 6, lineHeight: 24 },
  subjectSubtitle: { fontSize: 13, marginBottom: 20 },
  cardButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: 'flex-start' },
  cardButtonText: { fontSize: 13, fontWeight: 'bold' },
  circularProgressText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  seeAllButton: { paddingRight: 20, marginBottom: 15 },
  seeAllText: { fontSize: 14, fontWeight: 'bold' },

  notificationsOuterContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  cardContainer: { borderRadius: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, overflow: 'hidden' },
  notificationItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  lastItem: { borderBottomWidth: 0 },
  itemContent: { flex: 1, paddingRight: 15 },
  messageText: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#00e676', marginRight: 6 },
  timeText: { fontSize: 12, fontWeight: '500' },
});