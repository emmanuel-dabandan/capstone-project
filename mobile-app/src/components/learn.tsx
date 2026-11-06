import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, FlatList, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/config';
import { useAppTheme } from '../lib/ThemeContext'; // THEME HOOK
import {
  DownloadedStudyPack,
  getAllDownloadedPacks,
  getActiveStudyPack,
  downloadLessonStudyPack,
  setActiveStudyPackId,
  removeDownloadedPack,
  makePackId,
} from '../lib/offlineStudyPacks';

const SUBJECT_COLORS = ['#5480e5', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
const FALLBACK_ICONS = ['bulb', 'earth', 'library', 'school', 'rocket', 'extension-puzzle'];

const getSubjectKey = (title: string) =>
  (title || '').trim().replace(/\s+/g, ' ').toLowerCase();

const hashString = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const getSubjectIcon = (name: string) => {
  const n = name.toLowerCase();
  if (/cook|food|kitchen|culinary|bak(e|ing)|nutrition/.test(n)) return 'restaurant';
  if (/math|numer|algebra|geometry|arithmetic/.test(n)) return 'calculator';
  if (/english|filipino|communicat|language|literacy|reading|writing/.test(n)) return 'chatbubbles';
  if (/science|biolog|chemi|physics/.test(n)) return 'flask';
  if (/social|history|civic|govern|geograph/.test(n)) return 'earth';
  if (/digital|computer|ict|technolog/.test(n)) return 'laptop';
  return FALLBACK_ICONS[hashString(n) % FALLBACK_ICONS.length];
};

export default function LearnScreen() {
  const { theme } = useAppTheme();
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [selectedToolRoute, setSelectedToolRoute] = useState('');
  const [expandedSubjectId, setExpandedSubjectId] = useState<any | null>(null);

  const [recommendation, setRecommendation] = useState<{ target_module: string, rationale: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [subjects, setSubjects] = useState<any[]>([]);

  // --- Offline Pack States ---
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<
    { id: string; subjectTitle: string; moduleTitle: string; lessonData: any }[]
  >([]);
  const [downloadedPacks, setDownloadedPacks] = useState<Record<string, DownloadedStudyPack>>({});
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAIRecommendation();
    fetchDatabaseModules();
    loadDownloadableLessons();
  }, []);

  const fetchAIRecommendation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${API_BASE_URL}/api/ai-recommendation/${user.id}`);
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        setRecommendation(data);
      } else {
        setRecommendation(null);
      }
    } catch (error) {
      console.error("Failed to load AI recommendation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDatabaseModules = async () => {
    try {
      const { data, error } = await supabase.from('ai_lessons').select('id, title, parsed_content');
      if (error) throw error;

      if (data) {
        const grouped = new Map<string, { id: string; name: string; icon: string; color: string; modules: string[] }>();

        data.forEach((row: any) => {
          const name = (row.title || '').trim() || 'Untitled Subject';
          const key = getSubjectKey(name);

          const lessonTitles: string[] =
            row.parsed_content && Array.isArray(row.parsed_content.lessons)
              ? row.parsed_content.lessons
                  .map((lesson: any) => lesson.lesson_title || lesson.title || lesson.topic)
                  .filter(Boolean)
              : [];

          const existing = grouped.get(key);
          if (existing) {
            lessonTitles.forEach((t) => {
              if (!existing.modules.includes(t)) existing.modules.push(t);
            });
          } else {
            grouped.set(key, {
              id: key,
              name,
              icon: getSubjectIcon(name),
              color: SUBJECT_COLORS[hashString(key) % SUBJECT_COLORS.length],
              modules: [...lessonTitles],
            });
          }
        });

        const dynamicSubjects = Array.from(grouped.values()).map((subject) => ({
          ...subject,
          modules: subject.modules.length > 0 ? subject.modules : [subject.name],
        }));

        setSubjects(dynamicSubjects);
      }
    } catch (error) {
      console.error("Error fetching dynamic modules:", error);
    }
  };

  const loadDownloadableLessons = async () => {
    const packs = await getAllDownloadedPacks();
    setDownloadedPacks(packs);
    const active = await getActiveStudyPack();
    setActivePackId(active?.id || null);

    const { data } = await supabase.from('ai_lessons').select('title, parsed_content');
    if (data) {
      const list: { id: string; subjectTitle: string; moduleTitle: string; lessonData: any }[] = [];
      data.forEach((row: any) => {
        const subjectTitle = row.title || 'Uncategorized';
        const lessons = row.parsed_content?.lessons || [];
        lessons.forEach((lesson: any) => {
          const moduleTitle = lesson.lesson_title || lesson.title || 'Lesson';
          const id = makePackId(subjectTitle, moduleTitle);
          list.push({ id, subjectTitle, moduleTitle, lessonData: lesson });
        });
      });
      setAvailableLessons(list);
    }
  };

  const handleDownloadLesson = async (item: {
    id: string;
    subjectTitle: string;
    moduleTitle: string;
    lessonData: any;
  }) => {
    try {
      setDownloadingId(item.id);
      await downloadLessonStudyPack({
        subjectTitle: item.subjectTitle,
        moduleTitle: item.moduleTitle,
        lessonData: item.lessonData,
      });
      const updated = await getAllDownloadedPacks();
      setDownloadedPacks(updated);
      setActivePackId(item.id);
      Alert.alert(
        'Downloaded for Offline!',
        `"${item.moduleTitle}" (with 10 Flashcards & 20 Practice Questions) is now saved and connected to your Flashcards and Practice Quiz.`
      );
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Could not download study pack.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSelectActivePack = async (packId: string) => {
    await setActiveStudyPackId(packId);
    setActivePackId(packId);
  };

  const handleDeletePack = async (packId: string) => {
    await removeDownloadedPack(packId);
    const updated = await getAllDownloadedPacks();
    setDownloadedPacks(updated);
    const active = await getActiveStudyPack();
    setActivePackId(active?.id || null);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.headerBg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.mainBackground, { backgroundColor: theme.bg }]}>

        <View style={[styles.topSection, { backgroundColor: theme.headerBg }]}>
          <Text style={styles.screenTitle}>Learn</Text>
          <TouchableOpacity
            style={[styles.headerDownloadBtn, { backgroundColor: theme.isDark ? '#334155' : '#eef3ff' }]}
            onPress={() => {
              loadDownloadableLessons();
              setDownloadModalVisible(true);
            }}
          >
            <Ionicons name="cloud-download-outline" size={24} color={theme.isDark ? '#60a5fa' : '#2e64e5'} />
            {Object.keys(downloadedPacks).length > 0 && (
              <View style={styles.badgeDownload}>
                <Text style={styles.badgeDownloadText}>{Object.keys(downloadedPacks).length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* AI Recommended Focus */}
          <View style={styles.aiCardContainer}>
            <Text style={styles.sectionSubtitleWhite}>Targeted review based on your latest assessment</Text>

            <TouchableOpacity
              style={[styles.aiCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              activeOpacity={0.8}
              disabled={isLoading || !recommendation}
              onPress={() => {
                if (recommendation) {
                  router.push(`/lesson?subject=${encodeURIComponent(recommendation.target_module)}` as any);
                }
              }}
            >
              {isLoading ? (
                <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                  <ActivityIndicator size="small" color={theme.isDark ? '#60a5fa' : '#2e64e5'} />
                </View>
              ) : (
                <>
                  <View style={{ flex: 1, paddingRight: 15 }}>
                    <View style={styles.aiHeaderRow}>
                      <Ionicons name="sparkles" size={16} color="#ffc107" style={{ marginRight: 6 }} />
                      <Text style={styles.aiBadgeText}>AI Insight</Text>
                    </View>
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                      {recommendation ? recommendation.target_module : 'Keep Exploring'}
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                      {recommendation ? recommendation.rationale : 'Complete more activities to get personalized AI tips!'}
                    </Text>
                  </View>
                  <View style={[styles.aiButton, theme.isDark && { backgroundColor: '#1d4ed8' }]}>
                    <Text style={styles.aiButtonText}>Review</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Subjects */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Subjects</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject.id}
                  style={[styles.subjectCardWide, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push({
                      pathname: '/lesson',
                      params: { subject: subject.name }
                    });
                  }}
                >
                  <View style={[styles.largeIconContainer, { backgroundColor: subject.color + '15' }]}>
                    <Ionicons name={subject.icon as any} size={40} color={subject.color} />
                  </View>
                  <Text style={[styles.subjectCardTitle, { color: theme.textPrimary }]} numberOfLines={2}>{subject.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Quizzes */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitlePad, { color: theme.textPrimary }]}>Quizzes</Text>
            <Text style={[styles.sectionSubtitlePad, { color: theme.textSecondary }]}>Check in on your pending evaluations</Text>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
              activeOpacity={0.8}
              onPress={() => {
                const currentSubject = subjects[0]?.name || 'Cookery & Food Safety';
                Alert.alert(
                  "Assessment Readiness",
                  "This 15-item evaluation can only be taken ONCE. Your final score will be permanently recorded.\n\nHave you fully reviewed the module, or would you like to practice first?",
                  [
                    { text: "Practice First", onPress: () => router.push({ pathname: '/practice', params: { subject: currentSubject } } as any) },
                    { text: "Cancel", style: "cancel" },
                    { text: "Start Evaluation", onPress: () => router.push({ pathname: '/quiz', params: { subject: currentSubject } }), style: "destructive" }
                  ]
                );
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Module 1 Assessment</Text>
                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Cookery & Food Safety • 15 Mins</Text>
              </View>
              <View style={[styles.startButton, theme.isDark && { backgroundColor: '#1d4ed8' }]}>
                <Text style={styles.startButtonText}>Start</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} style={{ marginLeft: 10 }} />
            </TouchableOpacity>
          </View>

          {/* Study Tools & Library */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitlePad, { color: theme.textPrimary, marginBottom: 15 }]}>My Library & Tools</Text>

            <View style={styles.toolsGrid}>
              {[
                { title: 'Flashcards', icon: 'albums-outline', route: '/flashcards' },
                { title: 'Practice', icon: 'barbell-outline', route: '/practice' },
                { title: 'Online Resources', icon: 'link-outline', route: 'resources' },
              ].map((tool, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.toolCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedToolRoute(tool.route);
                    setShowSubjectPicker(true);
                  }}
                >
                  <View style={[styles.toolIconWrapper, theme.isDark && { backgroundColor: '#334155' }]}>
                    <Ionicons name={tool.icon as any} size={24} color={theme.isDark ? '#60a5fa' : '#2e64e5'} />
                  </View>
                  <Text style={[styles.toolText, { color: theme.textPrimary }]}>{tool.title}</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>

      {/* Dynamic Subject & Module Selector Modal */}
      <Modal visible={showSubjectPicker} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select a Module</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Expand a subject to choose your specific review material.</Text>

            <ScrollView style={{ maxHeight: 350 }}>
              {subjects.map((subject) => (
                <View key={subject.id}>
                  <TouchableOpacity
                    style={[styles.subjectOption, { borderBottomColor: theme.divider }]}
                    onPress={() => setExpandedSubjectId(expandedSubjectId === subject.id ? null : subject.id)}
                  >
                    <Text style={[styles.subjectOptionText, { color: theme.isDark ? '#60a5fa' : '#2e64e5' }, expandedSubjectId === subject.id && { color: subject.color }]}>
                      {subject.name}
                    </Text>
                    <Ionicons
                      name={expandedSubjectId === subject.id ? "chevron-down" : "chevron-forward"}
                      size={20}
                      color={expandedSubjectId === subject.id ? subject.color : theme.textSecondary}
                    />
                  </TouchableOpacity>

                  {expandedSubjectId === subject.id && (
                    <View style={[styles.modulesContainer, { backgroundColor: theme.isDark ? '#0f172a' : '#f9fafb', borderBottomColor: theme.divider }]}>
                      {subject.modules.map((moduleName: string, index: number) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.moduleOption}
                          onPress={() => {
                            setShowSubjectPicker(false);
                            setExpandedSubjectId(null);

                            if (selectedToolRoute === 'resources') {
                              Alert.alert(
                                "Online Resources",
                                "No external links have been extracted for this module yet. This feature will be available once the backend extraction is updated."
                              );
                            } else {
                              router.push({
                                pathname: selectedToolRoute,
                                params: { subject: subject.name, module: moduleName }
                              } as any);
                            }
                          }}
                        >
                          <Ionicons name="document-text-outline" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                          <Text style={[styles.moduleOptionText, { color: theme.textPrimary }]}>{moduleName}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.cancelButton, theme.isDark && { backgroundColor: '#334155' }]}
              onPress={() => {
                setShowSubjectPicker(false);
                setExpandedSubjectId(null);
              }}
            >
              <Text style={[styles.cancelButtonText, theme.isDark && { color: '#f8fafc' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Download Pack Modal */}
      <Modal
        visible={downloadModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <View style={styles.modalOverlayDown}>
          <View style={[styles.modalCardDown, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeaderDown}>
              <View>
                <Text style={[styles.modalTitleDown, { color: theme.textPrimary }]}>Download Lessons</Text>
                <Text style={[styles.modalSubtitleDown, { color: theme.textSecondary }]}>
                  Includes 10 Flashcards + 20 Practice Quiz items
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDownloadModalVisible(false)}>
                <Ionicons name="close" size={26} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableLessons}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isDownloaded = !!downloadedPacks[item.id];
                const isActive = activePackId === item.id;
                const isDownloading = downloadingId === item.id;

                return (
                  <View style={[styles.lessonRowDown, { backgroundColor: theme.isDark ? '#0f172a' : '#fcfaf8', borderColor: theme.borderColor }, isActive && styles.lessonRowActiveDown]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.subjectLabelDown}>{item.subjectTitle}</Text>
                      <Text style={[styles.moduleLabelDown, { color: theme.textPrimary }]}>{item.moduleTitle}</Text>
                      {isDownloaded && (
                        <Text style={styles.packMetaDown}>
                          {isActive ? '★ Connected to Flashcards & Practice' : 'Saved offline (10 cards • 20 quiz items)'}
                        </Text>
                      )}
                    </View>

                    {isDownloading ? (
                      <ActivityIndicator size="small" color={theme.isDark ? '#60a5fa' : '#2e64e5'} />
                    ) : isDownloaded ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!isActive && (
                          <TouchableOpacity
                            style={[styles.useBtnDown, theme.isDark && { backgroundColor: '#1d4ed8' }]}
                            onPress={() => handleSelectActivePack(item.id)}
                          >
                            <Text style={styles.useBtnTextDown}>Connect</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.deleteBtnDown}
                          onPress={() => handleDeletePack(item.id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#e53935" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.downloadBtnDown, theme.isDark && { backgroundColor: '#1d4ed8' }]}
                        onPress={() => handleDownloadLesson(item)}
                      >
                        <Ionicons name="download-outline" size={18} color="#fff" />
                        <Text style={styles.downloadBtnTextDown}>Download</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  mainBackground: { flex: 1 },

  topSection: { paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, paddingHorizontal: 20, paddingTop: 10, zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  scrollContent: { paddingBottom: 100, paddingTop: 10 },
  sectionContainer: { marginBottom: 35 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitlePad: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 20 },
  sectionSubtitlePad: { fontSize: 13, paddingHorizontal: 20, marginTop: 4, marginBottom: 15 },
  sectionSubtitleWhite: { fontSize: 13, color: '#e0e8f9', paddingHorizontal: 20, marginBottom: 10, marginTop: -35, zIndex: 10 },

  horizontalScroll: { gap: 15, paddingHorizontal: 20 },

  aiCardContainer: { marginBottom: 30 },
  aiCard: { marginHorizontal: 20, borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, zIndex: 20, marginTop: 20 },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#ffc107', textTransform: 'uppercase' },
  aiButton: { backgroundColor: '#2e64e5', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  aiButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  subjectCardWide: { width: 140, borderRadius: 16, padding: 12, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  largeIconContainer: { width: '100%', height: 90, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  subjectCardTitle: { fontSize: 14, fontWeight: 'bold', lineHeight: 20, textAlign: 'center' },

  toolsGrid: { flexDirection: 'column', gap: 12, paddingHorizontal: 20 },
  toolCard: { width: '100%', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  toolIconWrapper: { backgroundColor: '#f0f4ff', padding: 10, borderRadius: 10, marginRight: 15 },
  toolText: { fontSize: 16, fontWeight: '600', flex: 1 },

  actionCard: { marginHorizontal: 20, borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { fontSize: 13 },
  startButton: { backgroundColor: '#2e64e5', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  startButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 24, padding: 25, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, marginBottom: 20 },
  subjectOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  subjectOptionText: { fontSize: 16, fontWeight: '600' },
  cancelButton: { marginTop: 20, alignItems: 'center', paddingVertical: 15, backgroundColor: '#f5f5f5', borderRadius: 12 },
  cancelButtonText: { fontSize: 16, fontWeight: 'bold', color: '#f44336' },

  modulesContainer: { paddingVertical: 5, paddingHorizontal: 15, borderBottomWidth: 1 },
  moduleOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  moduleOptionText: { fontSize: 14, fontWeight: '500' },

  headerDownloadBtn: { padding: 8, borderRadius: 12, position: 'relative' },
  badgeDownload: { position: 'absolute', top: -4, right: -4, backgroundColor: '#e65100', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' },
  badgeDownloadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  modalOverlayDown: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCardDown: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeaderDown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleDown: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitleDown: { fontSize: 12, marginTop: 2 },
  lessonRowDown: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  lessonRowActiveDown: { borderColor: '#2e64e5', backgroundColor: '#f2f6ff' },
  subjectLabelDown: { fontSize: 11, fontWeight: 'bold', color: '#2e64e5', textTransform: 'uppercase' },
  moduleLabelDown: { fontSize: 15, fontWeight: 'bold', marginTop: 2 },
  packMetaDown: { fontSize: 12, color: '#2e7d32', marginTop: 4, fontWeight: '600' },
  downloadBtnDown: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2e64e5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  downloadBtnTextDown: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  useBtnDown: { backgroundColor: '#2e64e5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  useBtnTextDown: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  deleteBtnDown: { padding: 6 },
});