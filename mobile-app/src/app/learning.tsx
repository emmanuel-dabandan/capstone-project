import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/ThemeContext';

interface KeyConcept {
  concept_title: string;
  concept_body: string;
}

interface ParsedLesson {
  lesson_title: string;
  duration_minutes: number;
  type: string;
  overview_title?: string;
  overview_body?: string;
  key_concepts?: KeyConcept[];
  full_module_text?: string;
  core_text?: string;
  knowledge_check_question?: string;
  activity?: any;
}

interface AIModule {
  module_title: string;
  lessons: ParsedLesson[];
}

// Helper: Split text into clean sentences without breaking decimals like 0.05
function splitSentences(text: string): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [cleaned];
}

// Helper: Derive a short, punchy heading from a sentence for Key Concept cards
function deriveConceptTitle(sentence: string, index: number, lessonTitle?: string): string {
  const s = sentence.trim();

  if (lessonTitle && lessonTitle.includes(':')) {
    const afterColon = lessonTitle.split(':')[1] || '';
    const parts = afterColon
      .split(/,|and/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 3);
    if (parts[index]) return parts[index];
  }

  const subjectMatch = s.match(
    /^(?:The\s+|A\s+|An\s+|In\s+[^,]+,\s*)?([A-Za-z0-9\s\-()]{4,38}?)(?:\s+(?:is|are|serves|determines|defines|refers|measures|represents|means|requires|shifts)\b)/i
  );
  if (subjectMatch && subjectMatch[1]) {
    const candidate = subjectMatch[1].trim();
    if (candidate.split(' ').length <= 6) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  const cleanedWords = s
    .replace(/^(In\s+other\s+words,|For\s+instance,|For\s+example,|Together,|However,|Therefore,|Additionally,)\s*/i, '')
    .replace(/[^a-zA-Z0-9\s\-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');

  return cleanedWords
    ? cleanedWords.charAt(0).toUpperCase() + cleanedWords.slice(1)
    : `Key Takeaway ${index + 1}`;
}

// Smart formatter: Concise AI Overview + 3-5 dynamic Key Concepts + paragraph-spaced Full Module
function buildSmartLessonView(lesson: ParsedLesson) {
  const rawFull = (
    lesson.full_module_text ||
    lesson.core_text ||
    lesson.overview_body ||
    ''
  ).trim();

  const sentences = splitSentences(rawFull);

  // 1. Concise AI Overview (2 sentences max)
  let overviewBody = (lesson.overview_body || '').trim();
  if (!overviewBody || overviewBody === rawFull || overviewBody.length > 360) {
    overviewBody =
      sentences.slice(0, 2).join(' ') ||
      rawFull.slice(0, 280) ||
      'No summary text available for this lesson.';
  }

  const overviewTitle =
    lesson.overview_title && lesson.overview_title !== lesson.lesson_title
      ? lesson.overview_title
      : 'Core Takeaway';

  // 2. Key Concepts (Dynamically scale between 3 and 5 cards based on scope)
  let keyConcepts: KeyConcept[] =
    Array.isArray(lesson.key_concepts) && lesson.key_concepts.length >= 3
      ? lesson.key_concepts.slice(0, 5)
      : [];

  if (keyConcepts.length === 0 && sentences.length > 2) {
    const remaining = sentences.slice(2);
    const remainingChars = remaining.join(' ').length;

    let targetCount = 3;
    if (remaining.length >= 12 || remainingChars >= 1400) {
      targetCount = 5;
    } else if (remaining.length >= 8 || remainingChars >= 900) {
      targetCount = 4;
    } else {
      targetCount = 3;
    }

    const numConcepts = Math.min(targetCount, remaining.length);
    const generated: KeyConcept[] = [];

    let cursor = 0;
    for (let i = 0; i < numConcepts; i++) {
      const itemsLeft = remaining.length - cursor;
      const slotsLeft = numConcepts - i;
      const size = Math.ceil(itemsLeft / slotsLeft);
      const chunk = remaining.slice(cursor, cursor + size);
      cursor += size;

      if (chunk.length > 0) {
        generated.push({
          concept_title: deriveConceptTitle(chunk[0], i, lesson.lesson_title),
          concept_body: chunk.join(' '),
        });
      }
    }
    keyConcepts = generated;
  } else if (keyConcepts.length === 0 && sentences.length > 0) {
    keyConcepts = sentences.slice(0, Math.min(3, sentences.length)).map((s, i) => ({
      concept_title: deriveConceptTitle(s, i, lesson.lesson_title),
      concept_body: s,
    }));
  }

  // 3. Formatted Full Module Paragraphs
  let fullParagraphs: string[] = [];
  if (rawFull.includes('\n')) {
    fullParagraphs = rawFull
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  } else if (sentences.length > 3) {
    for (let i = 0; i < sentences.length; i += 3) {
      fullParagraphs.push(sentences.slice(i, i + 3).join(' '));
    }
  } else if (rawFull) {
    fullParagraphs = [rawFull];
  }

  return {
    overviewTitle,
    overviewBody,
    keyConcepts,
    fullParagraphs,
  };
}

export default function LearningScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { lessonData, subject, moduleId, lessonIndex, totalLessons } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'full'>('overview');
  const [moduleData, setModuleData] = useState<AIModule | null>(null);
  const [currentLesson, setCurrentLesson] = useState<ParsedLesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestLesson();
  }, [lessonData, moduleId]);

  const fetchLatestLesson = async () => {
    try {
      let query = supabase.from('ai_lessons').select('*');
      if (moduleId) {
        query = query.eq('id', moduleId);
      } else if (subject) {
        query = query.eq('title', subject).order('created_at', { ascending: false }).limit(1);
      } else {
        query = query.order('created_at', { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (data?.parsed_content) {
        setModuleData(data.parsed_content);
      }

      if (lessonData) {
        setCurrentLesson(JSON.parse(lessonData as string));
      } else if (data?.parsed_content?.lessons?.length > 0) {
        setCurrentLesson(data.parsed_content.lessons[0]);
      }
    } catch (error: any) {
      console.error('Error fetching learning data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getConceptIcon = (index: number) => {
    const designStyles = [
      { name: 'bulb-outline', color: '#3B82F6', bg: '#DBEAFE' },
      { name: 'git-network-outline', color: '#8B5CF6', bg: '#EDE9FE' },
      { name: 'analytics-outline', color: '#10B981', bg: '#D1FAE5' },
      { name: 'layers-outline', color: '#F59E0B', bg: '#FEF3C7' },
      { name: 'shield-checkmark-outline', color: '#14B8A6', bg: '#CCFBF1' },
    ];
    return designStyles[index % designStyles.length];
  };

  const formattedView = useMemo(() => {
    if (!currentLesson) return null;
    return buildSmartLessonView(currentLesson);
  }, [currentLesson]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!currentLesson || !formattedView) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textPrimary }}>No lesson content found. Please upload a module.</Text>
      </View>
    );
  }

  const lessonIdxNum = parseInt((lessonIndex as string) || '0', 10);
  const totalLessonsNum = parseInt((totalLessons as string) || String(moduleData?.lessons?.length || 1), 10);
  const progressPercent = Math.round(((lessonIdxNum + 1) / Math.max(1, totalLessonsNum)) * 100);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={[styles.header, { backgroundColor: theme.headerBg }]} edges={['top']}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.cardBg }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="arrow-back" size={20} color="#3B82F6" />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.subjectText} numberOfLines={1}>
              {moduleData?.module_title || (subject as string) || 'Module'}
            </Text>
            <Text style={styles.lessonTitle} numberOfLines={1}>{currentLesson.lesson_title}</Text>
          </View>

          <Text style={styles.counterText}>{lessonIdxNum + 1}/{totalLessonsNum}</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabelText}>Lesson Progress</Text>
            <Text style={styles.progressLabelText}>{progressPercent}%</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeTab === 'overview'
                ? styles.toggleBtnActive
                : [styles.toggleBtnInactive, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]
            ]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={18} color={activeTab === 'overview' ? '#FFF' : theme.textSecondary} />
            <Text
              style={[styles.toggleText, activeTab === 'overview' ? styles.toggleTextActive : { color: theme.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              AI Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              activeTab === 'full'
                ? styles.toggleBtnActive
                : [styles.toggleBtnInactive, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]
            ]}
            onPress={() => setActiveTab('full')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={18} color={activeTab === 'full' ? '#FFF' : theme.textSecondary} />
            <Text style={[styles.toggleText, activeTab === 'full' ? styles.toggleTextActive : { color: theme.textSecondary }]}>
              Read Full Module
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          <View>
            <View style={styles.badgesRow}>
              <View style={[styles.aiBadge, theme.isDark && { backgroundColor: '#334155' }]}>
                <Ionicons name="sparkles" size={13} color="#F59E0B" style={{ marginRight: 5 }} />
                <Text style={[styles.aiBadgeText, theme.isDark && { color: '#f8fafc' }]}>Quick Summary</Text>
              </View>
              <View style={[styles.xpBadge, theme.isDark && { backgroundColor: '#1e3a8a' }]}>
                <Ionicons name="star-outline" size={14} color={theme.isDark ? '#60a5fa' : '#3B82F6'} />
                <Text style={[styles.xpBadgeText, theme.isDark && { color: '#60a5fa' }]}> +50 XP</Text>
              </View>
            </View>

            {/* Concise AI Overview Card */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircleBlue, theme.isDark && { backgroundColor: '#1e3a8a' }]}>
                  <Ionicons name="information" size={18} color="#3B82F6" />
                </View>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{formattedView.overviewTitle}</Text>
              </View>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                {formattedView.overviewBody}
              </Text>
            </View>

            {/* Key Concepts Section (Dynamic 3-5 cards) */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Key Concepts</Text>

            {formattedView.keyConcepts.map((concept, index) => {
              const iconStyle = getConceptIcon(index);
              return (
                <View key={index} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                  <View style={styles.conceptHeader}>
                    <View
                      style={[
                        styles.conceptIconBox,
                        { backgroundColor: theme.isDark ? '#1e293b' : iconStyle.bg }
                      ]}
                    >
                      <Ionicons name={iconStyle.name as any} size={20} color={iconStyle.color} />
                    </View>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{concept.concept_title}</Text>
                  </View>
                  <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                    {concept.concept_body}
                  </Text>
                </View>
              );
            })}

            <View style={[styles.disclaimerBox, theme.isDark && { backgroundColor: '#1e3a8a' }]}>
              <Ionicons name="book-outline" size={20} color={theme.isDark ? '#93c5fd' : '#3B82F6'} style={{ marginTop: 2, marginRight: 10 }} />
              <Text style={[styles.disclaimerText, theme.isDark && { color: '#dbeafe' }]}>
                This AI summary covers the most important points. Switch to Read Full Module for detailed content and examples.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.fullModuleContainer}>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <Text style={[styles.fullModuleHeading, { color: theme.textPrimary }]}>
                {currentLesson.lesson_title}
              </Text>
              {formattedView.fullParagraphs.map((para, idx) => (
                <Text
                  key={idx}
                  style={[
                    styles.fullModuleParagraph,
                    { color: theme.textPrimary },
                    idx === formattedView.fullParagraphs.length - 1 && { marginBottom: 0 }
                  ]}
                >
                  {para}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => {
            router.push({
              pathname: '/activity' as any,
              params: {
                lessonData: JSON.stringify(currentLesson),
                subject: (subject as string) || '',
                moduleId: (moduleId as string) || '',
                lessonIndex: String(lessonIdxNum),
                totalLessons: String(totalLessonsNum),
              }
            });
          }}
        >
          <Text style={styles.primaryButtonText}>Start Activity</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 20 },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1, paddingHorizontal: 15 },
  subjectText: { color: '#BFDBFE', fontSize: 13, marginBottom: 4 },
  lessonTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  counterText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  progressSection: { width: '100%' },
  progressBarBg: { height: 6, backgroundColor: '#1E40AF', borderRadius: 3, marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabelText: { color: '#93C5FD', fontSize: 12 },
  scrollContent: { padding: 20, paddingBottom: 25 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1 },
  toggleBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB', elevation: 2, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  toggleBtnInactive: {},
  toggleText: { fontSize: 14, fontWeight: '600', marginLeft: 6, flexShrink: 1 },
  toggleTextActive: { color: '#FFF' },
  badgesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  aiBadgeText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  xpBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  xpBadgeText: { color: '#2563EB', fontSize: 12, fontWeight: 'bold' },
  card: { borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconCircleBlue: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, lineHeight: 22 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginTop: 8, marginBottom: 12, marginLeft: 4 },
  conceptHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  conceptIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  disclaimerBox: { flexDirection: 'row', backgroundColor: '#DBEAFE', padding: 16, borderRadius: 12, marginTop: 6, marginBottom: 15 },
  disclaimerText: { flex: 1, color: '#1D4ED8', fontSize: 13, lineHeight: 20 },
  fullModuleContainer: { paddingTop: 4 },
  fullModuleHeading: { fontSize: 18, fontWeight: 'bold', marginBottom: 14, lineHeight: 24 },
  fullModuleParagraph: { fontSize: 15, lineHeight: 24, marginBottom: 14 },
  footer: { padding: 20, borderTopWidth: 1 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});