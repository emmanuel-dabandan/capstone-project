import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LearnScreen() {
  const subjects = [
    { id: 1, name: 'Cookery & Food Safety', icon: 'restaurant', color: '#5480e5' }, 
    { id: 2, name: 'Oral Communication', icon: 'chatbubbles', color: '#3B82F6' }, 
    { id: 3, name: 'General Mathematics', icon: 'calculator', color: '#10B981' }, 
    { id: 4, name: 'Personal Development', icon: 'bulb', color: '#F59E0B' }, 
    { id: 5, name: 'Earth & Life Science', icon: 'earth', color: '#EC4899' }, 
    { id: 6, name: 'Understanding Culture', icon: 'library', color: '#6366F1' }, 
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>
        
        
        {/* 🟠 TOP SECTION (Blue Background, Curved Bottom) */}
        <View style={styles.topSection}>
          <Text style={styles.screenTitle}>Learn</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* 🟠 1. AI Recommended Focus (Floats over the curve) */}
          <View style={styles.aiCardContainer}>
            <Text style={styles.sectionSubtitleWhite}>Targeted review based on your latest assessment</Text>
            
            <TouchableOpacity style={styles.aiCard} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <View style={styles.aiHeaderRow}>
                  <Ionicons name="sparkles" size={16} color="#ffc107" style={{ marginRight: 6 }} />
                  <Text style={styles.aiBadgeText}>AI Recommended</Text>
                </View>
                <Text style={styles.cardTitle}>Kitchen Tools & Equipment</Text>
                <Text style={styles.cardSubtitle}>7 concepts to review • 10 Mins</Text>
              </View>
              <View style={styles.aiButton}>
                <Text style={styles.aiButtonText}>Review</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 🟠 2. Subjects Horizontal Scroll */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Subjects</Text>
              <TouchableOpacity activeOpacity={0.7} style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {subjects.map((subject) => (
                <TouchableOpacity key={subject.id} style={styles.subjectCardWide} activeOpacity={0.8}>
                  <View style={[styles.largeIconContainer, { backgroundColor: subject.color + '15' }]}>
                    <Ionicons name={subject.icon as any} size={40} color={subject.color} />
                  </View>
                  <Text style={styles.subjectCardTitle} numberOfLines={2}>{subject.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 🟠 3. Pending Quizzes */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>Quizzes</Text>
            <Text style={styles.sectionSubtitlePad}>Check in on your pending evaluations</Text>
            
            <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Module 1 Assessment</Text>
                <Text style={styles.cardSubtitle}>Cookery & Food Safety • 15 Mins</Text>
              </View>
              <View style={styles.startButton}>
                <Text style={styles.startButtonText}>Start</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#bbbbbb" style={{ marginLeft: 10 }} />
            </TouchableOpacity>
          </View>

          {/* 🟠 4. Study Tools & Library */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>My Library & Tools</Text>
            
            <View style={styles.toolsGrid}>
              <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
                <Ionicons name="albums-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Flashcards</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
                <Ionicons name="fitness-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Practice</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Saved</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
                <Ionicons name="download-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Downloads</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* 🟠 5. Quick References */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>Quick References</Text>
            <Text style={styles.sectionSubtitlePad}>Hands-on guides for practical application</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              <TouchableOpacity style={styles.referenceCard} activeOpacity={0.8}>
                <View style={styles.referenceIconWrapper}>
                  <Ionicons name="thermometer-outline" size={24} color="#e65100" />
                </View>
                <Text style={styles.referenceText}>Safe Cooking Temps</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.referenceCard} activeOpacity={0.8}>
                <View style={styles.referenceIconWrapper}>
                  <Ionicons name="scale-outline" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.referenceText}>Measurement Conversions</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.referenceCard} activeOpacity={0.8}>
                <View style={styles.referenceIconWrapper}>
                  <Ionicons name="cut-outline" size={24} color="#10B981" />
                </View>
                <Text style={styles.referenceText}>Knife Cuts Guide</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

        </ScrollView>
      </View>

      {/* 🟠 Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/dashboard' as any)}>
          <Ionicons name="home-outline" size={24} color="#888888" style={styles.iconMargin} />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        
        {/* Active Tab (Pill styling for middle tabs) */}
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Ionicons name="book" size={24} color="#ffffff" style={styles.iconMargin} />
          <Text style={styles.navTextActive}>Learn</Text>
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
  
  topSection: {
    backgroundColor: '#2e64e5', 
    paddingBottom: 40, 
    borderBottomLeftRadius: 35, 
    borderBottomRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 1,
  },
  
  screenTitle: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  
  scrollContent: { paddingBottom: 100, paddingTop: 10 },

  sectionContainer: { marginBottom: 35 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitlePad: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 20 },
  sectionSubtitlePad: { fontSize: 13, color: '#888', paddingHorizontal: 20, marginTop: 4, marginBottom: 15 },
  sectionSubtitleWhite: { fontSize: 13, color: '#e0e8f9', paddingHorizontal: 20, marginBottom: 10, marginTop: -35, zIndex: 10 },
  
  seeAllButton: { paddingRight: 20, marginBottom: 15 },
  seeAllText: { fontSize: 14, fontWeight: 'bold', color: '#2e64e5' },
  horizontalScroll: { gap: 15, paddingHorizontal: 20 }, 

  // --- AI Recommendation Card (Floats over header) ---
  aiCardContainer: { marginBottom: 30 },
  aiCard: { 
    marginHorizontal: 20, 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#d0ddff', 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 6, 
    zIndex: 20,
    marginTop: 20,
  },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#ffc107', textTransform: 'uppercase' },
  aiButton: { backgroundColor: '#2e64e5', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  aiButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  // --- Subjects Horizontal Wide Cards ---
  subjectCardWide: { 
    width: 140, 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: '#e0d8d0',
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4 
  },
  largeIconContainer: { width: '100%', height: 90, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  subjectCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', lineHeight: 20, textAlign: 'center' },

  // --- Tools & Library Grid ---
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  toolCard: { 
    width: '48%', 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    paddingVertical: 18, 
    paddingHorizontal: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1, 
    borderColor: '#e0d8d0',
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  toolIcon: { marginRight: 8 },
  toolText: { fontSize: 14, fontWeight: '600', color: '#333' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#e65100', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

  // --- Quick References Scroll ---
  referenceCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    padding: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: 220,
    borderWidth: 1, 
    borderColor: '#e0d8d0',
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  referenceIconWrapper: { backgroundColor: '#f5f7fa', padding: 8, borderRadius: 8, marginRight: 12 },
  referenceText: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1, flexWrap: 'wrap' },

  // --- Action Cards (Quizzes) ---
  actionCard: { 
    marginHorizontal: 20,
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 18, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: '#e0d8d0',
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#888' },
  startButton: { backgroundColor: '#2e64e5', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  startButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  // --- Bottom Navigation ---
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
    borderRadius: 20, 
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 6
  }, 
  iconMargin: { marginBottom: 4 }, 
  navText: { fontSize: 12, color: '#888', fontWeight: '500' },
  navTextActive: { fontSize: 12, color: '#ffffff', fontWeight: 'bold' }
});