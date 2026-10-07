import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase'; 

export default function LearnScreen() {
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [selectedToolRoute, setSelectedToolRoute] = useState('');
  const [expandedSubjectId, setExpandedSubjectId] = useState<any | null>(null);
  
  const [recommendation, setRecommendation] = useState<{ target_module: string, rationale: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic subjects state populated directly from Supabase
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    fetchAIRecommendation();
    fetchDatabaseModules();
  }, []);

  const fetchAIRecommendation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`https://glorious-happiness-x5955j7qpxqgfp4p9-3000.app.github.dev/api/ai-recommendation/${user.id}`);
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        setRecommendation(data);
      } else {
        console.error("Backend returned HTML instead of JSON. Check if your Codespace port 3000 is Public.");
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
        const colors = ['#5480e5', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
        const icons = ['restaurant', 'chatbubbles', 'calculator', 'bulb', 'earth', 'library'];
        
        const dynamicSubjects = data.map((row, index) => {
          let extractedModules: string[] = [];
          if (row.parsed_content && Array.isArray(row.parsed_content.lessons)) {
            extractedModules = row.parsed_content.lessons.map((lesson: any) => lesson.lesson_title || lesson.title || lesson.topic);
          }
          
          const cleanModules = extractedModules.filter(Boolean);

          return {
            id: row.id || index,
            name: row.title, 
            icon: icons[index % icons.length], 
            color: colors[index % colors.length],
            modules: cleanModules.length > 0 ? cleanModules : [row.title] 
          };
        });

        setSubjects(dynamicSubjects);
      }
    } catch (error) {
      console.error("Error fetching dynamic modules:", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainBackground}>
        
        <View style={styles.topSection}>
          <Text style={styles.screenTitle}>Learn</Text>
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

              <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
                <Ionicons name="download-outline" size={24} color="#2e64e5" style={styles.toolIcon} />
                <Text style={styles.toolText}>Downloads</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2e64e5' }, 
  mainBackground: { flex: 1, backgroundColor: '#fcfaf8' },
  
  topSection: { backgroundColor: '#2e64e5', paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, paddingHorizontal: 20, paddingTop: 10, zIndex: 1, alignItems: 'center' },
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
});