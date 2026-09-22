import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;


// 🟢 NEW: Dynamic SVG Progress Ring Component
const ProgressCircle = ({ progress }: { progress: number }) => {
  const size = 70;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Calculate how much of the ring should be empty
  const fillAmount = circumference - (progress / 100) * circumference;
  const isZero = progress === 0;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Faded Background Track */}
        <Circle 
          cx={size / 2} cy={size / 2} r={radius} 
          stroke={isZero ? '#00000020' : '#ffffff40'} 
          strokeWidth={strokeWidth} fill="none" 
        />
        {/* Active Progress Ring */}
        <Circle 
          cx={size / 2} cy={size / 2} r={radius} 
          stroke={isZero ? '#000000' : '#ffffff'} 
          strokeWidth={strokeWidth} fill="none" 
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={fillAmount}
          strokeLinecap="round" // Gives the ends of the progress bar rounded edges
          rotation="-90" // Starts the progress bar at 12 o'clock
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.circularProgressText, { opacity: isZero ? 0.5 : 1 }]}>
        {progress}%
      </Text>
    </View>
  );
};

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

  // 🟢 NEW: State to hold the infinite scrolling modules
// 🟢 NEW: Creates 100 copies of your 6 subjects (600 cards total)
  // 🟢 Creates 600 unique objects so React never sees a duplicate key
  const infiniteModules = Array(100)
    .fill(learningModules)
    .flat()
    .map((module, index) => ({
      ...module,
      uniqueId: `card-${index}` // e.g., "card-0", "card-1", "card-599"
    }));
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      
      <View style={styles.mainBackground}>
        
        <View style={styles.topSection}>
          
          <View style={styles.headerBar}>
            <View style={styles.statPill}>
              <Text style={styles.statTextXP}>{xp} XP</Text>
            </View>
            
            <View style={[styles.statPill, { borderColor: '#ff9800', backgroundColor: '#fff3e0' }]}>
              <Text style={[styles.statText, { color: '#e65100' }]}>{streak} Day Streak</Text>
            </View>
          </View>

          <View style={styles.welcomeContainer}>
            <Text style={styles.greetingText}>Ready to learn,</Text>
            <Text style={styles.nameText}>{firstName}?</Text>
          </View>

        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
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

          <View style={styles.carouselContainer}>
            <Text style={styles.sectionTitle}>Your Learning Path</Text>
            
            <FlatList 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              snapToInterval={CARD_WIDTH + 15}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              data={infiniteModules}
              
              // 🟢 Tell FlatList to use our new guaranteed unique ID
              keyExtractor={(item) => item.uniqueId}
              
              initialScrollIndex={learningModules.length * 50} 
              
              getItemLayout={(data, index) => ({
                length: CARD_WIDTH + 15,
                offset: (CARD_WIDTH + 15) * index,
                index,
              })}

              renderItem={({ item: module }) => (
                // 🟢 Ensure there is NO key property on this View!
                <View style={[styles.subjectCard, { width: CARD_WIDTH }]}>
                  <View style={styles.cardContentRow}>
                    
                    {/* Left Side (65%): Text & Button */}
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

                   {/* Right Side (35%): Dynamic Circular Progress */}
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
            
            <TouchableOpacity activeOpacity={0.7} style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notificationsContainer}>
            <TouchableOpacity style={styles.notificationCard} activeOpacity={0.7}>
              <View style={styles.notificationTextWrapper}>
                <Text style={styles.notificationTitle}>New Module Available</Text>
                <Text style={styles.notificationMessage}>The ALS Coordinator has unlocked a new Cookery lesson.</Text>
                <Text style={styles.notificationTime}>2 hours ago</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#2e64e5" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.notificationCard} activeOpacity={0.7}>
              <View style={styles.notificationTextWrapper}>
                <Text style={styles.notificationTitle}>AI Insight</Text>
                <Text style={styles.notificationMessage}>You are showing 85% mastery! Ready for a quick evaluation?</Text>
                <Text style={styles.notificationTime}>Yesterday</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#2e64e5" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Ionicons name="home" size={24} color="#ffffff" style={styles.iconMargin} />
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => router.push('/learn' as any)}
        >
          <Ionicons name="book-outline" size={24} color="#888888" style={styles.iconMargin} />
          <Text style={styles.navText}>Learn</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="bar-chart-outline" size={24} color="#888888" style={styles.iconMargin} />
          <Text style={styles.navText}>Stats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile' as any)}>
          <Ionicons name="person-outline" size={24} color="#888888" style={styles.iconMargin} />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2e64e5' }, 
  mainBackground: { flex: 1, backgroundColor: '#fcfaf8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8' },
  
  topSection: {
    backgroundColor: '#2e64e5', 
    paddingBottom: 20, 
    borderBottomLeftRadius: 35, 
    borderBottomRightRadius: 35,
    zIndex: 1,
  },
  
  scrollContent: { paddingBottom: 100, paddingTop: 10 }, 

  // 🟢 CLEANED UP: Removed the duplicate headerBar style
  headerBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 15, 
    paddingHorizontal: 20, 
    paddingTop: 10, 
    paddingBottom: 25 
  },
  
  statPill: { 
    flex: 1, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#ffffff', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#d0ddff' 
  },  
  
  statIcon: { fontSize: 16, marginRight: 5 },
  statTextXP: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  statText: { fontSize: 14, fontWeight: 'bold' },

  welcomeContainer: { paddingHorizontal: 20 },
  greetingText: { fontSize: 18, color: '#e0e8f9' }, 
  nameText: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' }, 

  sectionHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'baseline' 
  },
  
  seeAllButton: {
    paddingRight: 20, 
    marginBottom: 15, 
  },
  
  seeAllText: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  
  challengeCard: { 
    marginHorizontal: 20, 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#d0ddff', 
    marginBottom: 30, 
    marginTop: 0, // 🟢 RESTORED: Re-added negative top margin so it overlaps the header
    elevation: 5, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 6, 
    zIndex: 20
  },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  timerText: { fontSize: 14, fontWeight: 'bold', color: '#ffffff' },  
  challengeButton: { backgroundColor: '#2e64e5', padding: 12, borderRadius: 10, alignItems: 'center' },
  challengeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  carouselContainer: { paddingBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, marginBottom: 15 },
  carouselContent: { paddingHorizontal: 20, gap: 15 },
  
  subjectCard: { 
    backgroundColor: '#5480e5', 
    borderRadius: 24,           
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
  
  subjectTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 6, lineHeight: 24 }, 
  subjectSubtitle: { fontSize: 13, color: '#a0b9c1', marginBottom: 20 }, 

  cardButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: 'flex-start' }, 
  startButton: { backgroundColor: '#fefefe' }, 
  continueButton: { backgroundColor: '#fefefe' }, 
  cardButtonText: { fontSize: 13, fontWeight: 'bold' },
  startButtonText: { color: '#000000' },
  continueButtonText: { color: '#050505' },

  circularProgress: { width: 70, height: 70, borderRadius: 35, borderWidth: 6, justifyContent: 'center', alignItems: 'center' },
  circularProgressText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },

  notificationsContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  notificationCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    paddingVertical: 10,   
    paddingHorizontal: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#e0d8d0', 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },  
  notificationTextWrapper: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  notificationMessage: { fontSize: 12, color: '#666', marginBottom: 6, lineHeight: 15 },
  notificationTime: { fontSize: 12, color: '#aaa', fontWeight: '500' },

  bottomNav: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    height: 80, 
    backgroundColor: '#ffffff', 
    flexDirection: 'row', 
    borderTopWidth: 1, 
    borderTopColor: '#e0d8d0' 
  },
  
  navItem: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingBottom: 15 
  },
  
  navItemActive: { 
    backgroundColor: '#2e64e5', 
    borderTopRightRadius: 30, 
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  }, 
  
  iconMargin: { marginBottom: 4 }, 
  
  navText: { fontSize: 12, color: '#888', fontWeight: '500' },
  navTextActive: { fontSize: 12, color: '#ffffff', fontWeight: 'bold' }
});