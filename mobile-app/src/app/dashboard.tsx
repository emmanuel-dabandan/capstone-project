import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

export default function DashboardScreen() {
  const learningModules = [
    { id: 1, title: 'Cookery & Food Safety', subtitle: 'Lesson 3: Kitchen Tools', progress: 80 },
    { id: 2, title: 'Oral Communication', subtitle: 'Lesson 1: Basics of Speech', progress: 15 },
    { id: 3, title: 'General Mathematics', subtitle: 'Lesson 1: Functions & Relations', progress: 0 },
    { id: 4, title: 'Personal Development', subtitle: 'Lesson 1: Knowing Oneself', progress: 0 },
    { id: 5, title: 'Earth & Life Science', subtitle: 'Lesson 4: Rock Forming Minerals', progress: 30 },
    { id: 6, title: 'Understanding Culture', subtitle: 'Lesson 1: Human Variations', progress: 0 },
  ];
  
  const [firstName, setFirstName] = useState('');
  const [strand, setStrand] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [xp, setXp] = useState(1250);
  const [streak, setStreak] = useState(5);
  const [timeLeft, setTimeLeft] = useState(38400);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/' as any);
          return;
        }

        const { data, error } = await supabase
          .from('students')
          .select('first_name, strand')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (data) {
          setFirstName(data.first_name);
          setStrand(data.strand || 'Explorer'); 
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🟠 Gamification Header */}
      <View style={styles.headerBar}>
        <View style={styles.statPill}>
          <Text style={styles.statIcon}>⭐</Text>
          <Text style={styles.statText}>{xp} XP</Text>
        </View>
        
        <View style={[styles.statPill, { borderColor: '#ff9800', backgroundColor: '#fff3e0' }]}>
          <Text style={styles.statIcon}>🔥</Text>
          <Text style={[styles.statText, { color: '#e65100' }]}>{streak} Day Streak</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 🟠 Welcome Text */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.greetingText}>Ready to learn,</Text>
          <Text style={styles.nameText}>{firstName}?</Text>
        </View>

        {/* 🟠 Today's Challenge */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>Today's Challenge</Text>
            <TouchableOpacity style={styles.challengeButton}>
              <Text style={styles.challengeButtonText}>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🟠 Main Progress Area (Swipeable Subjects) */}
        <View style={styles.carouselContainer}>
          <Text style={styles.sectionTitle}>Your Learning Path</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            snapToInterval={CARD_WIDTH + 15}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
          >
            {learningModules.map((module) => (
              <View key={module.id} style={[styles.subjectCard, { width: CARD_WIDTH }]}>
                <View style={styles.cardContentRow}>
                  
                  {/* Left Side (65%): Text & Button aligned perfectly like the image */}
                  <View style={styles.cardLeft}>
                    <Text style={styles.subjectTitle} numberOfLines={2}>
                      {module.title}
                    </Text>
                    <Text style={styles.subjectSubtitle} numberOfLines={1}>
                      {module.subtitle}
                    </Text>

                    <TouchableOpacity 
                      style={[styles.cardButton, module.progress === 0 ? styles.startButton : styles.continueButton]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.cardButtonText, module.progress === 0 ? styles.startButtonText : styles.continueButtonText]}>
                        {module.progress === 0 ? 'Start Task' : 'View Task'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Right Side (35%): Circular Progress */}
                  <View style={styles.cardRight}>
                    <View style={[
                      styles.circularProgress, 
                      { 
                        // Muted dark teal for 0%, vibrant yellow/orange for active progress
                        borderColor: module.progress === 0 ? '#3A5A66' : '#E8A34A',
                      }
                    ]}>
                      <Text style={[styles.circularProgressText, { opacity: module.progress === 0 ? 0.5 : 1 }]}>
                        {module.progress}%
                      </Text>
                    </View>
                  </View>

                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 🟠 Recent Updates / Notifications Area */}
        <View style={styles.notificationsContainer}>
          <Text style={styles.sectionTitle}>Recent Updates</Text>

          <TouchableOpacity style={styles.notificationCard} activeOpacity={0.7}>
            <View style={styles.notificationTextWrapper}>
              <Text style={styles.notificationTitle}>New Module Available</Text>
              <Text style={styles.notificationMessage}>The ALS Coordinator has unlocked a new Cookery lesson.</Text>
              <Text style={styles.notificationTime}>2 hours ago</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.notificationCard} activeOpacity={0.7}>
            <View style={styles.notificationTextWrapper}>
              <Text style={styles.notificationTitle}>AI Insight</Text>
              <Text style={styles.notificationMessage}>You are showing 85% mastery! Ready for a quick evaluation?</Text>
              <Text style={styles.notificationTime}>Yesterday</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* 🟠 Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navText}>Learn</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navText}>Stats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile' as any)}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fcfaf8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8' },
  scrollContent: { paddingBottom: 100 }, 

  headerBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  statPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef3ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#d0ddff' },
  statIcon: { fontSize: 16, marginRight: 5 },
  statText: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },

  welcomeContainer: { paddingHorizontal: 20, marginBottom: 20 },
  greetingText: { fontSize: 18, color: '#666' },
  nameText: { fontSize: 28, fontWeight: 'bold', color: '#333' },

  challengeCard: { marginHorizontal: 20, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 2, borderColor: '#2e64e5', marginBottom: 30, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  timerText: { fontSize: 14, fontWeight: 'bold', color: '#d9534f' },
  challengeButton: { backgroundColor: '#2e64e5', padding: 12, borderRadius: 10, alignItems: 'center' },
  challengeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  carouselContainer: { paddingBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, marginBottom: 15 },
  carouselContent: { paddingHorizontal: 20, gap: 15 },
  
  // 🟢 INSPO LAYOUT STYLES START HERE 🟢
  subjectCard: { 
    backgroundColor: '#224b55', // Deep Teal Background
    borderRadius: 24,           // Highly rounded corners
    padding: 20, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 5 
  },
  cardContentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { width: '65%', justifyContent: 'center', paddingRight: 15 },
  cardRight: { width: '35%', alignItems: 'flex-end', justifyContent: 'center' },
  
  // Card Text
  subjectTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 6, lineHeight: 24 }, 
  subjectSubtitle: { fontSize: 13, color: '#a0b9c1', marginBottom: 20 }, // Faded teal-white

  // Action Buttons (Moved to the left column under text)
  cardButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: 'flex-start' }, // Pill shape, wraps text
  startButton: { backgroundColor: '#3A5A66' }, // Muted button for unstarted
  continueButton: { backgroundColor: '#E8A34A' }, // Yellow-orange from inspo image
  cardButtonText: { fontSize: 13, fontWeight: 'bold' },
  startButtonText: { color: '#ffffff' },
  continueButtonText: { color: '#ffffff' },

  // Circular Progress (Pure RN, Solid Border)
  circularProgress: { width: 70, height: 70, borderRadius: 35, borderWidth: 6, justifyContent: 'center', alignItems: 'center' },
  circularProgressText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  // 🟢 INSPO LAYOUT STYLES END HERE 🟢

  notificationsContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  notificationCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e0d8d0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  notificationTextWrapper: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  notificationMessage: { fontSize: 14, color: '#666', marginBottom: 6, lineHeight: 20 },
  notificationTime: { fontSize: 12, color: '#aaa', fontWeight: '500' },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: '#ffffff', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e0d8d0', paddingBottom: 15 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navIcon: { fontSize: 24, color: '#888', marginBottom: 4 },
  navText: { fontSize: 12, color: '#888', fontWeight: '500' },
  navIconActive: { fontSize: 24, color: '#2e64e5', marginBottom: 4 },
  navTextActive: { fontSize: 12, color: '#2e64e5', fontWeight: 'bold' }
});