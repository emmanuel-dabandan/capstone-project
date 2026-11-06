import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/ThemeContext';

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

interface DBRow {
  id: string;
  title: string;
  subtitle: string;
  progress?: number;
  parsed_content: AIModule;
}

export default function LessonScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { subject } = useLocalSearchParams();
  const subjectName = typeof subject === 'string' ? subject : 'Course Modules';

  const [modules, setModules] = useState<DBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchModules();
    }, [subjectName])
  );

  const fetchModules = async () => {
    try {
      setLoading(true);
      let query = supabase.from('ai_lessons').select('*').order('created_at', { ascending: false }).limit(8);
      if (subjectName && subjectName !== 'Course Modules') {
        query = query.eq('title', subjectName);
      }
      const { data, error } = await query;
      if (error) throw error;
      setModules(data || []);
      if (data && data.length > 0) {
        setExpandedModuleId(data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching modules:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'video': return 'videocam';
      case 'quiz': return 'chatbubble-ellipses';
      default: return 'document-text';
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>

        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.moduleBadge, theme.isDark && { backgroundColor: '#1e3a8a' }]}>
            <Text style={[styles.moduleBadgeText, theme.isDark && { color: '#60a5fa' }]}>SUBJECT MODULES</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{subjectName}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Complete each lesson sequentially to unlock the next one.</Text>

          {modules.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>No modules uploaded for {subjectName} yet.</Text>
            </View>
          ) : (
            modules.map((mod, moduleIndex) => {
              const isExpanded = expandedModuleId === mod.id;
              const parsed = mod.parsed_content;
              const lessons = parsed?.lessons || [];

              const moduleTitle = parsed?.module_title || mod.subtitle || `Module ${moduleIndex + 1}`;
              const moduleSubtitle = parsed?.module_subtitle || "Structured learning module";
              const estTime = parsed?.total_estimated_time || 0;

              const totalLessons = lessons.length || 1;
              const completedLessons = Math.round(((mod.progress || 0) / 100) * totalLessons);

              return (
                <View key={mod.id} style={[styles.moduleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1 }]}>
                  <TouchableOpacity
                    style={styles.moduleHeader}
                    activeOpacity={0.7}
                    onPress={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                  >
                    <View style={styles.moduleHeaderLeft}>
                      <Text style={[styles.moduleCardTitle, { color: theme.textPrimary }]}>{moduleTitle}</Text>
                      <Text style={[styles.moduleCardMeta, { color: theme.textSecondary }]}>
                        {lessons.length} Lessons  •  {estTime} mins
                      </Text>
                    </View>
                    <View style={[styles.expandIconBox, theme.isDark && { backgroundColor: '#334155' }]}>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#3B82F6" />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.lessonsContainer, { borderTopColor: theme.divider }]}>
                      <Text style={[styles.moduleCardSubtitle, { color: theme.textSecondary }]}>{moduleSubtitle}</Text>

                      {lessons.map((lesson, index) => {
                        const isCompleted = index < completedLessons;
                        const isActive = index === completedLessons;
                        const isLocked = index > completedLessons;

                        return (
                          <TouchableOpacity
                            key={index}
                            style={[styles.lessonRow, { borderBottomColor: theme.divider }, isLocked && { opacity: 0.5 }]}
                            disabled={isLocked}
                            activeOpacity={0.7}
                            onPress={() => {
                              router.push({
                                pathname: '/learning',
                                params: { lessonData: JSON.stringify(lesson) }
                              });
                            }}
                          >
                            <View style={[
                              styles.iconBox,
                              isLocked
                                ? [styles.iconBoxLocked, theme.isDark && { backgroundColor: '#334155' }]
                                : [styles.iconBoxActive, theme.isDark && { backgroundColor: '#1e3a8a' }]
                            ]}>
                              <Ionicons
                                name={isLocked ? 'lock-closed' : getIconForType(lesson.type) as any}
                                size={20}
                                color={isLocked ? '#A0AAB5' : '#3B82F6'}
                              />
                            </View>

                            <View style={styles.lessonTextContainer}>
                              <Text style={[styles.lessonTitle, { color: theme.textPrimary }]}>{lesson.lesson_title || "Untitled Lesson"}</Text>
                              <View style={styles.lessonMetaRow}>
                                <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                                <Text style={[styles.lessonMetaText, { color: theme.textSecondary }]}> {lesson.duration_minutes || 5} min  •  {lesson.type || 'reading'}</Text>
                              </View>
                            </View>

                            <View style={styles.statusIconContainer}>
                              {isCompleted && <Ionicons name="checkmark-circle" size={24} color="#10B981" />}
                              {isActive && !isCompleted && <Ionicons name="play-circle" size={24} color="#3B82F6" />}
                              {!isCompleted && !isActive && !isLocked && <Ionicons name="ellipse-outline" size={24} color={theme.textSecondary} />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  moduleBadge: { backgroundColor: '#EBF3FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  moduleBadgeText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, lineHeight: 22, marginBottom: 25 },
  moduleCard: { borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  moduleHeaderLeft: { flex: 1, paddingRight: 15 },
  moduleCardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  moduleCardMeta: { fontSize: 13, fontWeight: '500' },
  expandIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F5FF', justifyContent: 'center', alignItems: 'center' },
  lessonsContainer: { paddingHorizontal: 20, paddingBottom: 20, borderTopWidth: 1 },
  moduleCardSubtitle: { fontSize: 14, fontStyle: 'italic', marginTop: 15, marginBottom: 10, lineHeight: 20 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  iconBoxActive: { backgroundColor: '#EBF3FF' },
  iconBoxLocked: { backgroundColor: '#F0F2F5' },
  lessonTextContainer: { flex: 1, paddingRight: 10 },
  lessonTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  lessonMetaRow: { flexDirection: 'row', alignItems: 'center' },
  lessonMetaText: { fontSize: 12, textTransform: 'capitalize' },
  statusIconContainer: { width: 28, alignItems: 'center' },
});