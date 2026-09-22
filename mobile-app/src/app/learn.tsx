import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

export default function LearnScreen() {
  const subjects = [
    { id: 1, name: 'Cookery & Food Safety', icon: '🍳', color: '#8B5CF6' }, 
    { id: 2, name: 'Oral Communication', icon: '🗣️', color: '#3B82F6' }, 
    { id: 3, name: 'General Mathematics', icon: '🧮', color: '#10B981' }, 
    { id: 4, name: 'Personal Development', icon: '🧠', color: '#F59E0B' }, 
    { id: 5, name: 'Earth & Life Science', icon: '🌍', color: '#EC4899' }, 
    { id: 6, name: 'Understanding Culture', icon: '🏛️', color: '#6366F1' }, 
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.screenTitle}>Learn</Text>

        {/* 🟠 1. AI Recommended Focus */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>✨ AI Recommended</Text>
          <Text style={styles.sectionSubtitle}>Targeted review based on your latest assessment</Text>
          
          <TouchableOpacity style={styles.aiCard} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Kitchen Tools & Equipment</Text>
              <Text style={styles.cardSubtitle}>7 concepts to review • 10 Mins</Text>
            </View>
            <View style={styles.aiButton}>
              <Text style={styles.aiButtonText}>Review</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 🟠 2. Subjects Horizontal Scroll (UPDATED DESIGN) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Subjects</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {subjects.map((subject) => (
              <TouchableOpacity key={subject.id} style={styles.subjectCardWide} activeOpacity={0.8}>
                <View style={[styles.largeIconContainer, { backgroundColor: subject.color }]}>
                  <Text style={styles.largeIconText}>{subject.icon}</Text>
                </View>
                <Text style={styles.subjectCardTitle} numberOfLines={2}>{subject.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 🟠 5. Pending Quizzes */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quizzes</Text>
          <Text style={styles.sectionSubtitle}>Check in on your pending evaluations</Text>
          
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <View>
              <Text style={styles.cardTitle}>Module 1 Assessment</Text>
              <Text style={styles.cardSubtitle}>Cookery & Food Safety • 15 Mins</Text>
            </View>
            <View style={styles.startButton}>
              <Text style={styles.startButtonText}>Start</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 🟠 3. Study Tools & Library */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>My Library & Tools</Text>
          
          <View style={styles.toolsGrid}>
            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <Text style={styles.toolIcon}>📇</Text>
              <Text style={styles.toolText}>Flashcards</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <Text style={styles.toolIcon}>🎯</Text>
              <Text style={styles.toolText}>Practice</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <Text style={styles.toolIcon}>⭐</Text>
              <Text style={styles.toolText}>Saved</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <Text style={styles.toolIcon}>🎒</Text>
              <Text style={styles.toolText}>Downloads</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🟠 4. Quick References / Cheat Sheets */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick References</Text>
          <Text style={styles.sectionSubtitle}>Hands-on guides for practical application</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            <TouchableOpacity style={styles.referenceCard} activeOpacity={0.8}>
              <Text style={styles.referenceIcon}>🌡️</Text>
              <Text style={styles.referenceText}>Safe Cooking Temps</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.referenceCard} activeOpacity={0.8}>
              <Text style={styles.referenceIcon}>⚖️</Text>
              <Text style={styles.referenceText}>Measurement Conversions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.referenceCard} activeOpacity={0.8}>
              <Text style={styles.referenceIcon}>🔪</Text>
              <Text style={styles.referenceText}>Knife Cuts Guide</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        

      </ScrollView>

      {/* 🟠 Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/dashboard' as any)}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>📚</Text>
          <Text style={styles.navTextActive}>Learn</Text>
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
  safeArea: { flex: 1, backgroundColor: '#0A0F1C' }, 
  scrollContent: { padding: 20, paddingBottom: 100 },

  screenTitle: { fontSize: 34, fontWeight: 'bold', color: '#ffffff', marginBottom: 30, marginTop: 10 },

  sectionContainer: { marginBottom: 35 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  sectionSubtitle: { fontSize: 14, color: '#8A99B5', marginTop: 4, marginBottom: 15 },
  seeAllText: { fontSize: 14, fontWeight: '600', color: '#ffffff', textDecorationLine: 'underline' },
  horizontalScroll: { gap: 15, paddingRight: 20 }, // Shared gap for all horizontal scrolls

  // --- AI Recommendation Card ---
  aiCard: { backgroundColor: '#161D2F', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#10B981' },
  aiButton: { backgroundColor: '#10B981', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  aiButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  // --- NEW: Subjects Horizontal Wide Cards ---
  subjectCardWide: { width: 150, backgroundColor: '#161D2F', borderRadius: 16, padding: 12 },
  largeIconContainer: { width: '100%', height: 120, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  largeIconText: { fontSize: 48 },
  subjectCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#ffffff', lineHeight: 22 },

  // --- Tools & Library Grid ---
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  toolCard: { width: '48%', backgroundColor: '#161D2F', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  toolIcon: { fontSize: 18, marginRight: 10 },
  toolText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },

  // --- Quick References Scroll ---
  referenceCard: { backgroundColor: '#161D2F', borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', width: 200 },
  referenceIcon: { fontSize: 24, marginRight: 10 },
  referenceText: { fontSize: 14, fontWeight: '600', color: '#ffffff', flex: 1, flexWrap: 'wrap' },

  // --- Action Cards (Quizzes) ---
  actionCard: { backgroundColor: '#161D2F', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#8A99B5' },
  startButton: { backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  startButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  // --- Dark Mode Bottom Navigation ---
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 85, backgroundColor: '#101625', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1c2438', paddingBottom: 20 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navIcon: { fontSize: 22, color: '#6A7A9C', marginBottom: 4 },
  navText: { fontSize: 12, color: '#6A7A9C', fontWeight: '500' },
  navIconActive: { fontSize: 22, color: '#10B981', marginBottom: 4 },
  navTextActive: { fontSize: 12, color: '#10B981', fontWeight: 'bold' }
});