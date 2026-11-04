import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/config';
import {
  DownloadedStudyPack,
  getAllDownloadedPacks,
  getActiveStudyPack,
  downloadLessonStudyPack,
  setActiveStudyPackId,
  removeDownloadedPack,
  makePackId,
} from '../lib/offlineStudyPacks';

// ---------- Subject grouping helpers ----------
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
        console.error(`AI recommendation: expected JSON from ${API_BASE_URL} but got HTTP ${response.status}.`);
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
      const { data, error } = await supabase
        .from('ai_lessons')
        .select('id, title, parsed_content');

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

    const { data } = await supabase
      .from('ai_lessons')
      .select('title, parsed_content');

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>

        <View style={styles.topSection}>
          <Text style={styles.screenTitle}>Learn</Text>
          <TouchableOpacity
            style={styles.headerDownloadBtn}
            onPress={() => {
              loadDownloadableLessons();
              setDownloadModalVisible(true);
            }}
          >
            <Ionicons name="cloud-download-outline" size={24} color="#2e64e5" />
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
              style={styles.aiCard}
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
                  <ActivityIndicator size="small" color="#2e64e5" />
                </View>
              ) : (
                <>
                  <View style={{ flex: 1, paddingRight: 15 }}>
                    <View style={styles.aiHeaderRow}>
                      <Ionicons name="sparkles" size={16} color="#ffc107" style={{ marginRight: 6 }} />
                      <Text style={styles.aiBadgeText}>AI Insight</Text>
                    </View>
                    <Text style={styles.cardTitle}>
                      {recommendation ? recommendation.target_module : 'Keep Exploring'}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {recommendation ? recommendation.rationale : 'Complete more activities to get personalized AI tips!'}
                    </Text>
                  </View>
                  <View style={styles.aiButton}>
                    <Text style={styles.aiButtonText}>Review</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Subjects */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Subjects</Text>
              <TouchableOpacity activeOpacity={0.7} style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject.id}
                  style={styles.subjectCardWide}
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
                  <Text style={styles.subjectCardTitle} numberOfLines={2}>{subject.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Quizzes */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitlePad}>Quizzes</Text>
            <Text style={styles.sectionSubtitlePad}>Check in on your pending evaluations</Text>

            <TouchableOpacity
              style={styles.actionCard}
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
                <Text style={styles.cardTitle}>Module 1 Assessment</Text>
                <Text style={styles.cardSubtitle}>Cookery & Food Safety • 15 Mins</Text>
              </View>
              <View style={styles.startButton}>
                <Text style={styles.startButtonText}>Start</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#bbbbbb" style={{ marginLeft: 10 }} />
            </TouchableOpacity>
          </View>

          {/* Study Tools & Library */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitlePad, { marginBottom: 15 }]}>My Library & Tools</Text>

            <View style={styles.toolsGrid}>
              <TouchableOpacity
                style={styles.toolCard}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedToolRoute('/flashcards');
                  setShowSubjectPicker(true);
                }}
              >
                <Ionicons name="albums-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Flashcards</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolCard}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedToolRoute('/practice');
                  setShowSubjectPicker(true);
                }}
              >
                <Ionicons name="barbell-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Practice</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Saved</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolCard}
                activeOpacity={0.8}
                onPress={() => {
                  loadDownloadableLessons();
                  setDownloadModalVisible(true);
                }}
              >
                <Ionicons name="download-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Downloads</Text>
                {Object.keys(downloadedPacks).length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{Object.keys(downloadedPacks).length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick References */}
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

      {/* Dynamic Subject & Module Selector Modal */}
      <Modal visible={showSubjectPicker} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select a Module</Text>
            <Text style={styles.modalSubtitle}>Expand a subject to choose your specific review material.</Text>

            <ScrollView style={{ maxHeight: 350 }}>
              {subjects.map((subject) => (
                <View key={subject.id}>
                  <TouchableOpacity
                    style={styles.subjectOption}
                    onPress={() => setExpandedSubjectId(expandedSubjectId === subject.id ? null : subject.id)}
                  >
                    <Text style={[styles.subjectOptionText, expandedSubjectId === subject.id && { color: subject.color }]}>
                      {subject.name}
                    </Text>
                    <Ionicons
                      name={expandedSubjectId === subject.id ? "chevron-down" : "chevron-forward"}
                      size={20}
                      color={expandedSubjectId === subject.id ? subject.color : "#aaa"}
                    />
                  </TouchableOpacity>

                  {expandedSubjectId === subject.id && (
                    <View style={styles.modulesContainer}>
                      {subject.modules.map((moduleName: string, index: number) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.moduleOption}
                          onPress={() => {
                            setShowSubjectPicker(false);
                            setExpandedSubjectId(null);
                            router.push({
                              pathname: selectedToolRoute,
                              params: { subject: subject.name, module: moduleName }
                            } as any);
                          }}
                        >
                          <Ionicons name="document-text-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                          <Text style={styles.moduleOptionText}>{moduleName}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowSubjectPicker(false);
                setExpandedSubjectId(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
          <View style={styles.modalCardDown}>
            <View style={styles.modalHeaderDown}>
              <View>
                <Text style={styles.modalTitleDown}>Download Lessons</Text>
                <Text style={styles.modalSubtitleDown}>
                  Includes 10 Flashcards + 20 Practice Quiz items
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDownloadModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
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
                  <View style={[styles.lessonRowDown, isActive && styles.lessonRowActiveDown]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.subjectLabelDown}>{item.subjectTitle}</Text>
                      <Text style={styles.moduleLabelDown}>{item.moduleTitle}</Text>
                      {isDownloaded && (
                        <Text style={styles.packMetaDown}>
                          {isActive ? '★ Connected to Flashcards & Practice' : 'Saved offline (10 cards • 20 quiz items)'}
                        </Text>
                      )}
                    </View>

                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#2e64e5" />
                    ) : isDownloaded ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!isActive && (
                          <TouchableOpacity
                            style={styles.useBtnDown}
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
                        style={styles.downloadBtnDown}
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
  safeArea: { flex: 1, backgroundColor: '#2e64e5' },
  mainBackground: { flex: 1, backgroundColor: '#fcfaf8' },

  topSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2e64e5', paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, paddingHorizontal: 20, paddingTop: 10, zIndex: 1 },
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

  aiCardContainer: { marginBottom: 30 },
  aiCard: { marginHorizontal: 20, backgroundColor: '#ffffff', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#d0ddff', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, zIndex: 20, marginTop: 20 },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#ffc107', textTransform: 'uppercase' },
  aiButton: { backgroundColor: '#2e64e5', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  aiButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  subjectCardWide: { width: 140, backgroundColor: '#ffffff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e0d8d0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  largeIconContainer: { width: '100%', height: 90, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  subjectCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', lineHeight: 20, textAlign: 'center' },

  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  toolCard: { width: '48%', backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e0d8d0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  toolIcon: { marginRight: 8 },
  toolText: { fontSize: 14, fontWeight: '600', color: '#333' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#e65100', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

  referenceCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', width: 220, borderWidth: 1, borderColor: '#e0d8d0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  referenceIconWrapper: { backgroundColor: '#f5f7fa', padding: 8, borderRadius: 8, marginRight: 12 },
  referenceText: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1, flexWrap: 'wrap' },

  actionCard: { marginHorizontal: 20, backgroundColor: '#ffffff', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e0d8d0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#888' },
  startButton: { backgroundColor: '#2e64e5', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  startButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', borderRadius: 24, padding: 25, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  subjectOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  subjectOptionText: { fontSize: 16, fontWeight: '600', color: '#2e64e5' },
  cancelButton: { marginTop: 20, alignItems: 'center', paddingVertical: 15, backgroundColor: '#f5f5f5', borderRadius: 12 },
  cancelButtonText: { fontSize: 16, fontWeight: 'bold', color: '#f44336' },

  modulesContainer: { backgroundColor: '#f9fafb', paddingVertical: 5, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  moduleOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  moduleOptionText: { fontSize: 14, color: '#444', fontWeight: '500' },

  // --- Download Modal & Button Styles ---
  headerDownloadBtn: { padding: 8, borderRadius: 12, backgroundColor: '#eef3ff', position: 'relative' },
  badgeDownload: { position: 'absolute', top: -4, right: -4, backgroundColor: '#e65100', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' },
  badgeDownloadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  modalOverlayDown: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCardDown: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeaderDown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleDown: { fontSize: 18, fontWeight: 'bold', color: '#382314' },
  modalSubtitleDown: { fontSize: 12, color: '#666', marginTop: 2 },
  lessonRowDown: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e6e0d8', marginBottom: 10, backgroundColor: '#fcfaf8' },
  lessonRowActiveDown: { borderColor: '#2e64e5', backgroundColor: '#f2f6ff' },
  subjectLabelDown: { fontSize: 11, fontWeight: 'bold', color: '#2e64e5', textTransform: 'uppercase' },
  moduleLabelDown: { fontSize: 15, fontWeight: 'bold', color: '#382314', marginTop: 2 },
  packMetaDown: { fontSize: 12, color: '#2e7d32', marginTop: 4, fontWeight: '600' },
  downloadBtnDown: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2e64e5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  downloadBtnTextDown: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  useBtnDown: { backgroundColor: '#2e64e5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  useBtnTextDown: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  deleteBtnDown: { padding: 6 },
});