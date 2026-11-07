import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/ThemeContext';
import { PROGRESS_STORAGE_KEY } from './activity';

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

interface QuizGradeRecord {
  id: string;
  module_title: string;
  score: number;
  total_items: number;
}

export default function LessonScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { subject, moduleId, unlockedCount, refreshTs } = useLocalSearchParams();
  const subjectName = typeof subject === 'string' ? subject : 'Course Modules';

  const [modules, setModules] = useState<DBRow[]>([]);
  const [localProgressMap, setLocalProgressMap] = useState<Record<string, number>>({});
  const [quizGrades, setQuizGrades] = useState<QuizGradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchModules();
    }, [subjectName, moduleId, unlockedCount, refreshTs])
  );

  const fetchModules = async () => {
    try {
      setLoading(true);

      // Load local completed lesson counts
      try {
        const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
        if (raw) {
          setLocalProgressMap(JSON.parse(raw));
        }
      } catch (e) {
        console.error('Error reading local progress:', e);
      }

      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase.from('ai_lessons').select('*').order('created_at', { ascending: true }).limit(12);
      if (subjectName && subjectName !== 'Course Modules') {
        query = query.eq('title', subjectName);
      }
      const { data, error } = await query;
      if (error) throw error;
      setModules(data || []);

      if (moduleId && typeof moduleId === 'string') {
        setExpandedModuleId(moduleId);
      } else if (data && data.length > 0 && !expandedModuleId) {
        setExpandedModuleId(data[0].id);
      }

      if (user) {
        const { data: gradesData } = await supabase
          .from('quiz_grades')
          .select('id, module_title, score, total_items')
          .eq('student_id', user.id);
        if (gradesData) {
          setQuizGrades(gradesData);
        }
      }
    } catch (error: any) {
      console.error('Error fetching modules:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const findModuleGrade = (subjTitle: string, modTitle: string, isSingleModule: boolean): QuizGradeRecord | undefined => {
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const composite = `${norm(subjTitle)} - ${norm(modTitle)}`;

    const exact = quizGrades.find(
      (g) => norm(g.module_title) === norm(modTitle) || norm(g.module_title) === composite
    );
    if (exact) return exact;

    if (isSingleModule || norm(modTitle) === norm(subjTitle)) {
      return quizGrades.find((g) => norm(g.module_title) === norm(subjTitle));
    }
    return undefined;
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
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/learn' as any);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.moduleBadge, theme.isDark && { backgroundColor: '#1e3a8a' }]}>
            <Text style={[styles.moduleBadgeText, theme.isDark && { color: '#60a5fa' }]}>SUBJECT MODULES</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{subjectName}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Complete each lesson sequentially to unlock the next one and the final module quiz.
          </Text>

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

              const moduleTitle = parsed?.module_title || mod.subtitle || `Week ${moduleIndex + 1}`;
              const moduleSubtitle = parsed?.module_subtitle || 'Structured learning module';
              const estTime = parsed?.total_estimated_time || 0;

              const totalLessons = lessons.length || 1;
              const dbCompleted = Math.round(((mod.progress || 0) / 100) * totalLessons);
              const localCompleted =
                localProgressMap[String(mod.id)] ||
                localProgressMap[mod.title || subjectName] ||
                0;
              const paramCompleted =
                moduleId && String(mod.id) === String(moduleId) && unlockedCount
                  ? parseInt(String(unlockedCount), 10) || 0
                  : 0;

              const completedLessons = Math.max(dbCompleted, localCompleted, paramCompleted);

              const allLessonsDone = lessons.length > 0 && completedLessons >= lessons.length;
              const recordedGrade = findModuleGrade(mod.title || subjectName, moduleTitle, modules.length === 1);
              const isQuizUnlocked = allLessonsDone || Boolean(recordedGrade);

              return (
                <View key={mod.id} style={[styles.moduleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, borderWidth: 1 }]}>
                  <TouchableOpacity
                    style={styles.moduleHeader}
                    activeOpacity={0.7}
                    onPress={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                  >
                    <View style={styles.moduleHeaderLeft}>
                      <Text style={styles.weekLabel}>WEEK {moduleIndex + 1}</Text>
                      <Text style={[styles.moduleCardTitle, { color: theme.textPrimary }]}>{moduleTitle}</Text>
                      <Text style={[styles.moduleCardMeta, { color: theme.textSecondary }]}>
                        {lessons.length} Lessons  •  {estTime} mins
                      </Text>
                    </View>
                    <View style={[styles.expandIconBox, theme.isDark && { backgroundColor: '#334155' }]}>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#3B82F6" />
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
                                params: {
                                  lessonData: JSON.stringify(lesson),
                                  subject: mod.title || subjectName,
                                  moduleId: String(mod.id),
                                  lessonIndex: String(index),
                                  totalLessons: String(lessons.length),
                                }
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
                              <Text style={[styles.lessonTitle, { color: theme.textPrimary }]}>{lesson.lesson_title || 'Untitled Lesson'}</Text>
                              <View style={styles.lessonMetaRow}>
                                <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                                <Text style={[styles.lessonMetaText, { color: theme.textSecondary }]}>
                                  {' '}{lesson.duration_minutes || 5} min  •  {lesson.type || 'reading'}
                                </Text>
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

                      {/* End-of-Module Final Quiz Row (Locked until all lessons are finished) */}
                      <TouchableOpacity
                        style={[
                          styles.quizRow,
                          {
                            backgroundColor: theme.isDark ? '#1e293b' : '#f8faff',
                            borderColor: isQuizUnlocked ? '#3B82F6' : theme.borderColor,
                          },
                          !isQuizUnlocked && { opacity: 0.55 },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isQuizUnlocked) {
                            Alert.alert(
                              'Assessment Locked',
                              `Please complete all ${lessons.length} lessons in this module first to unlock the final evaluation.`
                            );
                            return;
                          }

                          if (recordedGrade) {
                            Alert.alert(
                              'Assessment Completed',
                              `You already completed this evaluation with a score of ${recordedGrade.score} / ${recordedGrade.total_items}.`
                            );
                            return;
                          }

                          const targetSubj = mod.title || subjectName;
                          Alert.alert(
                            'Assessment Readiness',
                            'This 15-item evaluation can only be taken ONCE. Your final score will be permanently recorded.\n\nHave you fully reviewed the module, or would you like to practice first?',
                            [
                              {
                                text: 'Practice First',
                                onPress: () =>
                                  router.push({
                                    pathname: '/practice',
                                    params: { subject: targetSubj, module: moduleTitle },
                                  } as any),
                              },
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Start Evaluation',
                                style: 'destructive',
                                onPress: () =>
                                  router.push({
                                    pathname: '/quiz',
                                    params: { subject: targetSubj, module: moduleTitle },
                                  } as any),
                              },
                            ]
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.iconBox,
                            !isQuizUnlocked
                              ? [styles.iconBoxLocked, theme.isDark && { backgroundColor: '#334155' }]
                              : { backgroundColor: recordedGrade ? '#10B98120' : '#DBEAFE' },
                          ]}
                        >
                          <Ionicons
                            name={!isQuizUnlocked ? 'lock-closed' : recordedGrade ? 'trophy' : 'ribbon'}
                            size={20}
                            color={!isQuizUnlocked ? '#A0AAB5' : recordedGrade ? '#10B981' : '#2563EB'}
                          />
                        </View>

                        <View style={styles.lessonTextContainer}>
                          <Text style={[styles.lessonTitle, { color: theme.textPrimary }]}>
                            Final Module Assessment
                          </Text>
                          <Text style={[styles.lessonMetaText, { color: theme.textSecondary, textTransform: 'none' }]}>
                            {!isQuizUnlocked
                              ? `Locked • Finish all ${lessons.length} lessons to unlock`
                              : recordedGrade
                              ? `Completed • Score: ${recordedGrade.score}/${recordedGrade.total_items}`
                              : '15 Items • Graded Evaluation'}
                          </Text>
                        </View>

                        <View style={styles.statusIconContainer}>
                          {recordedGrade ? (
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                          ) : isQuizUnlocked ? (
                            <Ionicons name="arrow-forward-circle" size={26} color="#2563EB" />
                          ) : (
                            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
                          )}
                        </View>
                      </TouchableOpacity>
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
  weekLabel: { fontSize: 11, fontWeight: 'bold', color: '#3B82F6', letterSpacing: 0.8, marginBottom: 4 },
  moduleCardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  moduleCardMeta: { fontSize: 13, fontWeight: '500' },
  expandIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F5FF', justifyContent: 'center', alignItems: 'center' },
  lessonsContainer: { paddingHorizontal: 20, paddingBottom: 20, borderTopWidth: 1 },
  moduleCardSubtitle: { fontSize: 14, fontStyle: 'italic', marginTop: 15, marginBottom: 10, lineHeight: 20 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  quizRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  iconBoxActive: { backgroundColor: '#EBF3FF' },
  iconBoxLocked: { backgroundColor: '#F0F2F5' },
  lessonTextContainer: { flex: 1, paddingRight: 10 },
  lessonTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  lessonMetaRow: { flexDirection: 'row', alignItems: 'center' },
  lessonMetaText: { fontSize: 12, textTransform: 'capitalize' },
  statusIconContainer: { width: 28, alignItems: 'center' },
});