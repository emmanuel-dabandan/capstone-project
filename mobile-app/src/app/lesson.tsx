import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient'; // Adjust path if needed

interface ParsedLesson {
  lesson_title: string;
  duration_minutes: number;
  type: 'reading' | 'video' | 'quiz';
  core_text: string;
}

interface AIModule {
  module_title: string;
  module_subtitle: string;
  total_estimated_time: number;
  lessons: ParsedLesson[];
}

export default function LessonScreen() {
  const router = useRouter();
  const [moduleData, setModuleData] = useState<AIModule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestModule();
  }, []);

  const fetchLatestModule = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_lessons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      
      // Fallback mapping in case the DB still has the old JSON format
      const parsed = data.parsed_content;
      if (Array.isArray(parsed)) {
        setModuleData({
          module_title: "Foundations of Society",
          module_subtitle: "Explore the fundamental building blocks that define human interaction and societal structures.",
          total_estimated_time: 64,
          lessons: parsed.map(p => ({
            lesson_title: p.lesson_title || "Untitled Lesson",
            duration_minutes: 5,
            type: 'reading',
            core_text: p.core_text || p.brief_summary || ""
          }))
        });
      } else {
        setModuleData(parsed);
      }
    } catch (error: any) {
      console.error("Error fetching lesson:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine icon based on lesson type
  const getIconForType = (type: string) => {
    switch (type) {
      case 'video': return 'videocam';
      case 'quiz': return 'chatbubble-ellipses';
      default: return 'document-text';
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!moduleData || !moduleData.lessons) {
    return (
      <View style={styles.loader}>
        <Text>No module data found.</Text>
      </View>
    );
  }

  const activeLessonIndex = 2; // Hardcoded for visual wireframe matching

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        
        {/* Top Navigation */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.moduleBadge}>
            <Text style={styles.moduleBadgeText}>MODULE 02</Text>
          </View>
          <View style={{ width: 24 }} /> {/* Spacer to center badge */}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <Text style={styles.headerTitle}>{moduleData.module_title}</Text>
          <Text style={styles.headerSubtitle}>{moduleData.module_subtitle}</Text>

          {/* Progress Card */}
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View>
                <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
                <Text style={styles.progressValue}>35% <Text style={styles.progressSubValue}>Completed</Text></Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.progressLabel}>ESTIMATED TIME</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="time-outline" size={14} color="#3B82F6" />
                  <Text style={styles.timeValue}> 42 min left</Text>
                </View>
              </View>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '35%' }]} />
            </View>
          </View>

          {/* Search & Filters */}
          <View style={styles.filterRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
              <TextInput placeholder="Search lessons..." style={styles.searchInput} placeholderTextColor="#888" />
            </View>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="filter-outline" size={20} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="swap-vertical" size={20} color="#333" />
            </TouchableOpacity>
          </View>

          {/* List Header */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderCount}>{moduleData.lessons.length} LESSONS IN THIS MODULE</Text>
            <TouchableOpacity>
              <Text style={styles.markReadText}>MARK ALL AS READ</Text>
            </TouchableOpacity>
          </View>

          {/* Lessons List */}
          {moduleData.lessons.map((lesson, index) => {
            const isCompleted = index < activeLessonIndex;
            const isActive = index === activeLessonIndex;
            const isLocked = index > activeLessonIndex + 1; // Allows one 'up next' item to be unlocked
            
            return (
              <TouchableOpacity 
                key={index} 
                style={[styles.lessonRow, isLocked && { opacity: 0.5 }]}
                disabled={isLocked}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, isLocked ? styles.iconBoxLocked : styles.iconBoxActive]}>
                  <Ionicons 
                    name={isLocked ? 'lock-closed' : getIconForType(lesson.type) as any} 
                    size={20} 
                    color={isLocked ? '#A0AAB5' : '#3B82F6'} 
                  />
                </View>
                
                <View style={styles.lessonTextContainer}>
                  <Text style={styles.lessonTitle}>{lesson.lesson_title}</Text>
                  <View style={styles.lessonMetaRow}>
                    <Ionicons name="time-outline" size={12} color="#888" />
                    <Text style={styles.lessonMetaText}> {lesson.duration_minutes} min  •  {lesson.type}</Text>
                  </View>
                </View>

                <View style={styles.statusIconContainer}>
                  {isCompleted && <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />}
                  {isActive && <Ionicons name="radio-button-on" size={24} color="#3B82F6" />}
                  {!isCompleted && !isActive && !isLocked && <Ionicons name="play-circle-outline" size={24} color="#C4C4C4" />}
                </View>
              </TouchableOpacity>
            );
          })}
          
          <View style={{ height: 100 }} /> {/* Padding for bottom button */}
        </ScrollView>

        {/* Floating Continue Button */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity style={styles.continueButton} activeOpacity={0.8}>
            <Ionicons name="school" size={24} color="#FFF" style={{ marginRight: 12 }} />
            <View>
              <Text style={styles.continueLabel}>CONTINUE LEARNING</Text>
              <Text style={styles.continueTitle}>{moduleData.lessons[activeLessonIndex]?.lesson_title || "Next Lesson"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFF" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  moduleBadge: { backgroundColor: '#EBF3FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  moduleBadgeText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold' },
  
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  headerSubtitle: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 25 },
  
  progressCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  progressLabel: { fontSize: 11, fontWeight: 'bold', color: '#888', letterSpacing: 0.5, marginBottom: 4 },
  progressValue: { fontSize: 22, fontWeight: 'bold', color: '#3B82F6' },
  progressSubValue: { fontSize: 14, fontWeight: '500', color: '#666' },
  timeValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  progressBarTrack: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 10 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15, height: 46, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },
  iconButton: { width: 46, height: 46, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 4 },
  listHeaderCount: { fontSize: 12, fontWeight: 'bold', color: '#888', letterSpacing: 0.5 },
  markReadText: { fontSize: 12, fontWeight: 'bold', color: '#3B82F6' },
  
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  iconBoxActive: { backgroundColor: '#EBF3FF' },
  iconBoxLocked: { backgroundColor: '#F0F2F5' },
  
  lessonTextContainer: { flex: 1, paddingRight: 15 },
  lessonTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  lessonMetaRow: { flexDirection: 'row', alignItems: 'center' },
  lessonMetaText: { fontSize: 13, color: '#888', textTransform: 'capitalize' },
  statusIconContainer: { width: 24, alignItems: 'center' },

  bottomButtonContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  continueButton: { backgroundColor: '#3B82F6', borderRadius: 16, flexDirection: 'row', alignItems: 'center', padding: 18, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  continueLabel: { fontSize: 11, fontWeight: 'bold', color: '#EBF3FF', letterSpacing: 0.5, marginBottom: 2 },
  continueTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
});