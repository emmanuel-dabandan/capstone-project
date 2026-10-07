import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// Define the new expected data structure
interface KeyConcept {
  concept_title: string;
  concept_body: string;
}

interface ParsedLesson {
  lesson_title: string;
  duration_minutes: number;
  type: string;
  overview_title: string;
  overview_body: string;
  key_concepts: KeyConcept[];
  full_module_text: string;
}

interface AIModule {
  module_title: string;
  lessons: ParsedLesson[];
}

export default function LearningScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'full'>('overview');
  const [moduleData, setModuleData] = useState<AIModule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestLesson();
  }, []);

  const fetchLatestLesson = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_lessons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setModuleData(data.parsed_content);
    } catch (error: any) {
      console.error("Error fetching learning data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to rotate through pretty icons/colors for the dynamic key concepts
  const getConceptIcon = (index: number) => {
    const designStyles = [
      { name: 'earth', color: '#10B981' },
      { name: 'git-network-outline', color: '#8B5CF6' },
      { name: 'people-circle-outline', color: '#F59E0B' },
      { name: 'bulb-outline', color: '#3B82F6' },
      { name: 'leaf-outline', color: '#14B8A6' }
    ];
    return designStyles[index % designStyles.length];
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!moduleData || !moduleData.lessons || moduleData.lessons.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>No lesson content found. Please upload a module.</Text>
      </View>
    );
  }

  // For testing, we grab the very first lesson in the module array
  const currentLesson = moduleData.lessons[0];

  return (
    <View style={styles.container}>
      {/* 🔵 BLUE HEADER SECTION */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#3B82F6" />
            </TouchableOpacity>
            
            <View style={styles.headerTextContainer}>
              <Text style={styles.subjectText}>{moduleData.module_title}</Text>
              <Text style={styles.lessonTitle}>{currentLesson.lesson_title}</Text>
            </View>
            
            <Text style={styles.counterText}>1/{moduleData.lessons.length}</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '5%' }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelText}>Progress</Text>
              <Text style={styles.progressLabelText}>0%</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* 🔘 TOGGLE BUTTONS */}
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleBtn, activeTab === 'overview' ? styles.toggleBtnActive : styles.toggleBtnInactive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={20} color={activeTab === 'overview' ? '#FFF' : '#6B7280'} />
            <Text 
              style={[styles.toggleText, activeTab === 'overview' ? styles.toggleTextActive : styles.toggleTextInactive]}
              numberOfLines={1} 
              adjustsFontSizeToFit
            >
              AI Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleBtn, activeTab === 'full' ? styles.toggleBtnActive : styles.toggleBtnInactive]}
            onPress={() => setActiveTab('full')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={20} color={activeTab === 'full' ? '#FFF' : '#6B7280'} />
            <Text style={[styles.toggleText, activeTab === 'full' ? styles.toggleTextActive : styles.toggleTextInactive]}>
              Read Full Module
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          <View>
            {/* 🏷️ BADGES ROW */}
            <View style={styles.badgesRow}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI Overview</Text>
              </View>
              <View style={styles.xpBadge}>
                <Ionicons name="star-outline" size={14} color="#3B82F6" />
                <Text style={styles.xpBadgeText}> +5 XP</Text>
              </View>
            </View>

            {/* 📝 MAIN DEFINITION CARD */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircleBlue}>
                  <Ionicons name="information" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.cardTitle}>{currentLesson.overview_title}</Text>
              </View>
              <Text style={styles.bodyText}>
                {currentLesson.overview_body}
              </Text>
            </View>

            {/* 🔑 DYNAMIC KEY CONCEPTS */}
            <Text style={styles.sectionTitle}>Key Concepts</Text>

            {currentLesson.key_concepts?.map((concept, index) => {
              const iconStyle = getConceptIcon(index);
              return (
                <View key={index} style={styles.card}>
                  <View style={styles.conceptHeader}>
                    <Ionicons name={iconStyle.name as any} size={24} color={iconStyle.color} style={styles.conceptIcon} />
                    <Text style={styles.cardTitle}>{concept.concept_title}</Text>
                  </View>
                  <Text style={styles.bodyText}>
                    {concept.concept_body}
                  </Text>
                </View>
              );
            })}

            {/* ℹ️ AI DISCLAIMER NOTE */}
            <View style={styles.disclaimerBox}>
              <Ionicons name="star-outline" size={20} color="#3B82F6" style={{ marginTop: 2, marginRight: 10 }} />
              <Text style={styles.disclaimerText}>
                This AI summary covers the most important points. Switch to Read Full Module for detailed content and references.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.fullModuleContainer}>
            <Text style={styles.bodyText}>{currentLesson.full_module_text}</Text>
          </View>
        )}

        {/* 🚀 START ACTIVITY BUTTON */}
          <TouchableOpacity 
            style={styles.primaryButton} 
            activeOpacity={0.8}
            onPress={() => {
              router.push({
                pathname: '/activity' as any, // 🟢 Add "as any" right here
                params: { lessonData: JSON.stringify(currentLesson) }
              });
            }}
          >
            <Text style={styles.primaryButtonText}>Start Activity</Text>
          </TouchableOpacity>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Inside styles in learning.tsx:
tabButton: {
  flexDirection: 'row',          // Ensures the icon and text sit side-by-side
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 14,
  gap: 8,                         // Separates the (i) icon from "AI-Generated Overview"
},
tabIcon: {
  marginRight: 6,                 // Fallback spacing for older React Native layouts
},
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 20 },
  backButton: { width: 36, height: 36, backgroundColor: '#FFF', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1, paddingHorizontal: 15 },
  subjectText: { color: '#BFDBFE', fontSize: 13, marginBottom: 4 },
  lessonTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  counterText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  progressSection: { width: '100%' },
  progressBarBg: { height: 6, backgroundColor: '#1E40AF', borderRadius: 3, marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabelText: { color: '#93C5FD', fontSize: 12 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  toggleBtn: {
    flex: 1, // 🟢 Forces the button to take exactly half the space
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8, // 🟢 Slightly smaller padding to fit the text
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB', elevation: 2, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  toggleBtnInactive: { backgroundColor: '#FFF', borderColor: '#E5E7EB' },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1, // 🟢 Prevents the text from pushing the icon out of bounds
  },
  toggleTextActive: { color: '#FFF' },
  toggleTextInactive: { color: '#6B7280' },
  badgesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  aiBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  aiBadgeText: { color: '#4B5563', fontSize: 12, fontWeight: '600' },
  xpBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  xpBadgeText: { color: '#2563EB', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircleBlue: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  bodyText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 10, marginBottom: 15, marginLeft: 5 },
  conceptHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  conceptIcon: { marginRight: 12 },
  disclaimerBox: { flexDirection: 'row', backgroundColor: '#DBEAFE', padding: 16, borderRadius: 12, marginTop: 5, marginBottom: 25 },
  disclaimerText: { flex: 1, color: '#1D4ED8', fontSize: 13, lineHeight: 20 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  fullModuleContainer: { paddingVertical: 20 }
  
});