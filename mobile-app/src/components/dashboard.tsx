import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { FlatList } from 'react-native-gesture-handler';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

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

const defaultSubjects = [
  { id: 1, title: 'Cookery & Food Safety', subtitle: 'No modules yet', progress: 0 },
  { id: 2, title: 'Oral Communication', subtitle: 'No modules yet', progress: 0 },
  { id: 3, title: 'General Mathematics', subtitle: 'No modules yet', progress: 0 },
];

export default function DashboardScreen() {
  const [firstName, setFirstName] = useState('');
  const [strand, setStrand] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [learningModules, setLearningModules] = useState(defaultSubjects);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isChallengeDone, setIsChallengeDone] = useState(false);

  const infiniteModules = Array(100).fill(learningModules).flat().map((module, index) => ({ ...module, uniqueId: `card-${index}` }));

  // Philippine Time (PHT) Midnight Calculator
  const getSecondsUntilPHTMidnight = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const phtNow = new Date(utcMs + (8 * 3600000)); // PHT is UTC+8
    const phtMidnight = new Date(phtNow);
    phtMidnight.setHours(24, 0, 0, 0);
    return Math.floor((phtMidnight.getTime() - phtNow.getTime()) / 1000);
  };

  useEffect(() => {
    setTimeLeft(getSecondsUntilPHTMidnight());
    const timer = setInterval(() => {
      setTimeLeft(getSecondsUntilPHTMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const registerForPushNotificationsAsync = async (userId: string) => {
        let token;
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#2e64e5' });
        }
        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus === 'granted') {
            token = (await Notifications.getExpoPushTokenAsync({ projectId: "your-expo-project-id-here" })).data;
            await supabase.from('students').update({ expo_push_token: token }).eq('id', userId);
          }
        }
      };

      const fetchDashboardData = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await registerForPushNotificationsAsync(user.id);

            const { data: profile } = await supabase
              .from('students')
              .select('first_name, strand, xp, streak, last_challenge_date') 
              .eq('id', user.id)
              .single();

            if (profile) {
              setFirstName(profile.first_name);
              setStrand(profile.strand || 'Explorer'); 
              setXp(profile.xp || 0);
              setStreak(profile.streak || 0);

              // Check if challenge is done today in PHT
              const todayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
              setIsChallengeDone(profile.last_challenge_date === todayPHT);

              // Update last active date
              await supabase.from('students').update({ last_active_date: todayPHT }).eq('id', user.id);
            }
          }

          const { data: lessonsData } = await supabase.from('ai_lessons').select('title, subtitle, progress').order('created_at', { ascending: false });
          if (lessonsData) {
            const mergedModules = defaultSubjects.map(subj => {
              const dbMatch = lessonsData.find(l => l.title === subj.title);
              return dbMatch ? { ...subj, subtitle: dbMatch.subtitle || 'Current Module', progress: dbMatch.progress || 0 } : subj;
            });
            setLearningModules(mergedModules);
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
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2e64e5" /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>
        
        <View style={styles.topSection}>
          <View style={styles.headerBar}>
            <View style={styles.statPill}><Text style={styles.statTextXP}>{xp} XP</Text></View>
            <View style={[styles.statPill, { borderColor: '#ff9800', backgroundColor: '#fff3e0' }]}><Text style={[styles.statText, { color: '#e65100' }]}>{streak} Day Streak</Text></View>
          </View>
          <View style={styles.welcomeContainer}>
            <Text style={styles.greetingText}>Welcome,</Text>
            <Text style={styles.nameText}>{firstName}!</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* THE NEW CHALLENGE CARD */}
          <View style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <View>
                <Text style={styles.challengeTitle}>Daily Challenge</Text>
                <Text style={styles.challengeSubtitle}>Review 3 past concepts</Text>
              </View>
              <View style={styles.challengeTimerBadge}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              </View>
            </View>

            <View style={styles.challengeFooter}>
              <View style={styles.rewardPill}>
                <Ionicons name="star" size={14} color="#fbc02d" />
                <Text style={styles.rewardText}>+150 XP</Text>
              </View>
              <TouchableOpacity 
                style={[styles.challengeButton, isChallengeDone && styles.challengeButtonDone]}
                disabled={isChallengeDone}
                onPress={() => router.push('/gauntlet' as any)}
              >
                <Text style={styles.challengeButtonText}>{isChallengeDone ? 'Completed' : 'Start Challenge'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.carouselContainer}>
            <Text style={styles.sectionTitle}>Your Learning Path</Text>
            <FlatList 
                style={{ transform: [{ translateX: Platform.OS === 'android' ? -15 : 0 }] }} 
                horizontal={true} nestedScrollEnabled={true} showsHorizontalScrollIndicator={false} snapToInterval={CARD_WIDTH + 15} snapToAlignment="center" decelerationRate="fast"
                contentContainerStyle={styles.carouselContent} data={infiniteModules} keyExtractor={(item) => item.uniqueId} initialScrollIndex={learningModules.length * 50} 
                getItemLayout={(data, index) => ({ length: CARD_WIDTH + 15, offset: (CARD_WIDTH + 15) * index, index })}
                ListHeaderComponent={Platform.OS === 'android' ? <View style={{ width: (width - CARD_WIDTH) / 2 - 7.5 }} /> : null}
                ListFooterComponent={Platform.OS === 'android' ? <View style={{ width: (width - CARD_WIDTH) / 2 - 7.5 }} /> : null}
                renderItem={({ item: module }) => (
                <View style={[styles.subjectCard, { width: CARD_WIDTH }]}>
                  <View style={styles.cardContentRow}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.subjectTitle} numberOfLines={2}>{module.title}</Text>
                      <Text style={styles.subjectSubtitle} numberOfLines={1}>{module.subtitle}</Text>
                      <TouchableOpacity style={[styles.cardButton, module.progress === 0 ? styles.startButton : styles.continueButton]} onPress={() => router.push(`/lesson?subject=${encodeURIComponent(module.title)}` as any)}>
                        <Text style={[styles.cardButtonText, module.progress === 0 ? styles.startButtonText : styles.continueButtonText]}>{module.progress === 0 ? 'Start Task' : 'View Task'}</Text>
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
            <Text style={styles.sectionTitle}>Recent Updates</Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.seeAllButton} onPress={() => router.push('/notifications' as any)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notificationsContainer}>
            <TouchableOpacity style={styles.notificationCard} activeOpacity={0.7}>
              <View style={styles.notificationTextWrapper}>
                <Text style={styles.notificationTitle}>New Module Available</Text>
                <Text style={styles.notificationMessage}>The ALS Coordinator has unlocked a new Cookery lesson.</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#2e64e5" />
            </TouchableOpacity>
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
  topSection: { backgroundColor: '#2e64e5', paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, zIndex: 1 },
  scrollContent: { paddingBottom: 100, paddingTop: 10 }, 
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 25 },
  statPill: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#d0ddff' },  
  statTextXP: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  statText: { fontSize: 14, fontWeight: 'bold' },
  welcomeContainer: { paddingHorizontal: 20 },
  greetingText: { fontSize: 18, color: '#e0e8f9' }, 
  nameText: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' }, 

  // Updated Challenge Card Styles
  challengeCard: { marginHorizontal: 20, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#d0ddff', marginBottom: 30, marginTop: 0, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, zIndex: 20 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  challengeTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  challengeSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  challengeTimerBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f0f4ff', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 10 
  },
  timerText: { fontSize: 12, fontWeight: 'bold', color: '#666', marginLeft: 4 },  
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff9c4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  rewardText: { fontSize: 14, fontWeight: 'bold', color: '#f57f17', marginLeft: 4 },
  challengeButton: { backgroundColor: '#2e64e5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  challengeButtonDone: { backgroundColor: '#4caf50' },
  challengeButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  carouselContainer: { paddingBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, marginBottom: 15 },
  carouselContent: { alignItems: 'center', paddingHorizontal: Platform.OS === 'ios' ? undefined : 0 },
  subjectCard: { marginHorizontal: 7.5, backgroundColor: '#5480e5', borderRadius: 24, padding: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  cardContentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { width: '65%', justifyContent: 'center', paddingRight: 15 },
  cardRight: { width: '35%', alignItems: 'flex-end', justifyContent: 'center' },
  subjectTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 6, lineHeight: 24 }, 
  subjectSubtitle: { fontSize: 13, color: '#a0b9c1', marginBottom: 20 }, 
  cardButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: 'flex-start' }, 
  startButton: { backgroundColor: '#fefefe' }, 
  continueButton: { backgroundColor: '#fefefe' }, 
  cardButtonText: { fontSize: 13, fontWeight: 'bold' },
  startButtonText: { color: '#000000' },
  continueButtonText: { color: '#050505' },
  circularProgressText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  seeAllButton: { paddingRight: 20, marginBottom: 15 },
  seeAllText: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  notificationsContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  notificationCard: { backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e0d8d0' },  
  notificationTextWrapper: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  notificationMessage: { fontSize: 12, color: '#666', lineHeight: 15 },
});