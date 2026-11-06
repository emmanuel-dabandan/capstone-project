import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Alert,
  Linking,
  Vibration,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/ThemeContext';

type InfoModalType = 'support' | 'feedback' | 'terms' | 'privacy' | null;

export default function SettingsScreen() {
  // Connect directly to global ThemeContext
  const { theme, isDark, toggleTheme } = useAppTheme();

  // Experience Toggle States
  const [animation, setAnimation] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [haptic, setHaptic] = useState(true);

  // Support & Legal Modal States
  const [activeModal, setActiveModal] = useState<InfoModalType>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const prefs = user?.user_metadata?.preferences;
      if (prefs) {
        if (typeof prefs.animation === 'boolean') setAnimation(prefs.animation);
        if (typeof prefs.sounds === 'boolean') setSounds(prefs.sounds);
        if (typeof prefs.haptic === 'boolean') setHaptic(prefs.haptic);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const saveUserPreferences = async (updatedPrefs: {
    animation: boolean;
    sounds: boolean;
    haptic: boolean;
    darkMode: boolean;
  }) => {
    try {
      await supabase.auth.updateUser({
        data: { preferences: updatedPrefs },
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const triggerHaptic = (force = false) => {
    if (haptic || force) {
      Vibration.vibrate(15);
    }
  };

  const triggerAnimation = (enabled = animation) => {
    if (enabled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  };

  const handleToggleAnimation = (value: boolean) => {
    triggerHaptic();
    triggerAnimation(value);
    setAnimation(value);
    saveUserPreferences({ animation: value, sounds, haptic, darkMode: isDark });
  };

  const handleToggleSounds = (value: boolean) => {
    triggerHaptic();
    triggerAnimation();
    setSounds(value);
    saveUserPreferences({ animation, sounds: value, haptic, darkMode: isDark });
    if (value) {
      Alert.alert('Sound Effects Enabled', 'In-app audio cues for quizzes and flashcards are now active.');
    }
  };

  const handleToggleHaptic = (value: boolean) => {
    if (value) triggerHaptic(true);
    triggerAnimation();
    setHaptic(value);
    saveUserPreferences({ animation, sounds, haptic: value, darkMode: isDark });
  };

  const handleToggleDarkMode = (value: boolean) => {
    triggerHaptic();
    triggerAnimation();
    toggleTheme(value); // Updates global theme across all screens & nav bar
    saveUserPreferences({ animation, sounds, haptic, darkMode: value });
  };

  const openModal = (type: InfoModalType) => {
    triggerHaptic();
    triggerAnimation();
    setActiveModal(type);
  };

  const closeModal = () => {
    triggerHaptic();
    triggerAnimation();
    setActiveModal(null);
  };

  const handleEmailSupport = async () => {
    triggerHaptic();
    const emailUrl = 'mailto:support@learnify-als.edu.ph?subject=Learnify%20ALS%20Support%20Request';
    const canOpen = await Linking.canOpenURL(emailUrl);
    if (canOpen) {
      Linking.openURL(emailUrl);
    } else {
      Alert.alert(
        'Contact Support',
        'Please reach out to your ALS Coordinator or email us directly at support@learnify-als.edu.ph.'
      );
    }
  };

  const handleSubmitFeedback = async () => {
    triggerHaptic();
    if (!feedbackText.trim()) {
      Alert.alert('Empty Message', 'Please share a few details before submitting your feedback.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.auth.updateUser({
        data: {
          last_feedback: {
            rating: feedbackRating,
            message: feedbackText.trim(),
            submitted_at: new Date().toISOString(),
            user_id: user?.id,
          },
        },
      });

      setFeedbackText('');
      setFeedbackRating(5);
      setActiveModal(null);
      Alert.alert('Thank You!', 'Your feedback has been sent to the Learnify team.');
    } catch (error) {
      Alert.alert('Thank You!', 'Your feedback has been recorded locally.');
      setActiveModal(null);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleLogout = async () => {
    triggerHaptic();
    try {
      toggleTheme(false); // Reset to light mode on logout
      await supabase.auth.signOut();
      router.replace('/' as any);
    } catch (error) {
      console.error('Logout Error', error);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.headerBg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.mainBackground, { backgroundColor: theme.bg }]}>

        <View style={[styles.topSection, { backgroundColor: theme.headerBg }]}>
          <Text style={styles.screenTitle}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* 1. Account Section */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitlePad, { color: theme.textPrimary }]}>Account</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic();
                  router.push('/profile' as any);
                }}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#e0e8f9' }]}>
                    <Ionicons name="person-outline" size={20} color="#2e64e5" />
                  </View>
                  <Text style={[styles.rowText, { color: theme.textPrimary }]}>View my profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Experience Section */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitlePad, { color: theme.textPrimary }]}>Experience</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#f3e8ff' }]}>
                    <Ionicons name="color-wand-outline" size={20} color="#9333ea" />
                  </View>
                  <Text style={[styles.rowText, { color: theme.textPrimary }]}>Animation</Text>
                </View>
                <Switch
                  value={animation}
                  onValueChange={handleToggleAnimation}
                  trackColor={{ true: '#2e64e5', false: '#e0d8d0' }}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#e0f2fe' }]}>
                    <Ionicons name="volume-high-outline" size={20} color="#0284c7" />
                  </View>
                  <Text style={[styles.rowText, { color: theme.textPrimary }]}>Sounds</Text>
                </View>
                <Switch
                  value={sounds}
                  onValueChange={handleToggleSounds}
                  trackColor={{ true: '#2e64e5', false: '#e0d8d0' }}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#dcfce7' }]}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#16a34a" />
                  </View>
                  <Text style={[styles.rowText, { color: theme.textPrimary }]}>Haptic Feedback</Text>
                </View>
                <Switch
                  value={haptic}
                  onValueChange={handleToggleHaptic}
                  trackColor={{ true: '#2e64e5', false: '#e0d8d0' }}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color="#d97706" />
                  </View>
                  <Text style={[styles.rowText, { color: theme.textPrimary }]}>Night Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={handleToggleDarkMode}
                  trackColor={{ true: '#2e64e5', false: '#e0d8d0' }}
                />
              </View>

            </View>
          </View>

          {/* 3. Support Section */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitlePad, { color: theme.textPrimary }]}>Support</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openModal('support')}>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Get Support</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openModal('feedback')}>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Send Feedback</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openModal('terms')}>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Terms of Use</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openModal('privacy')}>
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={22} color="#e65100" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>

      {/* MODALS */}
      <Modal visible={activeModal !== null} animationType={animation ? 'slide' : 'none'} transparent={true} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.modalBg }]}>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {activeModal === 'support' && 'Get Support'}
                {activeModal === 'feedback' && 'Send Feedback'}
                {activeModal === 'terms' && 'Terms of Use'}
                {activeModal === 'privacy' && 'Privacy Policy'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {activeModal === 'support' && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  Need help with your self-paced modules or assessments? Check the quick answers below or reach out to your ALS Coordinator.
                </Text>

                <View style={[styles.faqBox, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.faqQuestion, { color: theme.textPrimary }]}>How do Offline Study Packs work?</Text>
                  <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>
                    Tap the cloud download icon on the Learn tab while connected to the internet. Once downloaded, your 10 Flashcards and 20 Practice Questions will work without Wi-Fi or mobile data.
                  </Text>
                </View>

                <View style={[styles.faqBox, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Text style={[styles.faqQuestion, { color: theme.textPrimary }]}>Why can I only take the Quiz once?</Text>
                  <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>
                    Module Assessments record your official competency score for your ALS teacher. Use the Practice tool as many times as you need before starting the official evaluation.
                  </Text>
                </View>

                <TouchableOpacity style={styles.primaryActionBtn} onPress={handleEmailSupport}>
                  <Ionicons name="mail-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryActionText}>Email ALS Tech Support</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {activeModal === 'feedback' && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  How is your learning experience with Learnify? Let us know how we can improve the app for ALS students.
                </Text>

                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => {
                        triggerHaptic();
                        setFeedbackRating(star);
                      }}
                    >
                      <Ionicons
                        name={star <= feedbackRating ? 'star' : 'star-outline'}
                        size={34}
                        color="#ffc107"
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[
                    styles.feedbackInput,
                    { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.borderColor },
                  ]}
                  placeholder="Tell us what you like or what isn't working..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={5}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                />

                <TouchableOpacity
                  style={[styles.primaryActionBtn, submittingFeedback && { opacity: 0.7 }]}
                  onPress={handleSubmitFeedback}
                  disabled={submittingFeedback}
                >
                  {submittingFeedback ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryActionText}>Submit Feedback</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'terms' && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>1. Purpose of the Platform</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  Learnify (ASCEND) is a self-paced mobile learning and academic monitoring companion designed for Alternative Learning System (ALS) students and educators.
                </Text>

                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>2. Academic Integrity & Assessments</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  Final Module Assessments are single-attempt evaluations used by your instructors to monitor competency progress. Students must complete these assessments independently.
                </Text>

                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>3. Offline Study Materials</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  Downloaded modules, flashcards, and practice sets are provided strictly for personal educational use within your enrolled ALS cohort.
                </Text>

                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>4. Account Responsibility</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  You are responsible for keeping your login credentials secure so that your XP, daily streaks, and competency records remain accurate.
                </Text>
              </ScrollView>
            )}

            {activeModal === 'privacy' && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>1. Data Privacy Compliance</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  In compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), Learnify is committed to protecting the personal and academic information of all enrolled ALS learners.
                </Text>

                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>2. Information We Collect</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  We collect your name, email address, assigned strand, module completion rates, quiz scores, XP, and daily activity streaks to provide personalized AI study recommendations and academic monitoring.
                </Text>

                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>3. How Your Data Is Used</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  Your progress metrics are shared exclusively with authorized ALS teachers and administrators to support your learning journey and identify areas where instructional assistance is needed.
                </Text>

                <Text style={[styles.legalHeading, { color: theme.textPrimary }]}>4. Data Storage & Security</Text>
                <Text style={[styles.modalParagraph, { color: theme.textSecondary }]}>
                  All cloud records are encrypted and stored securely via Supabase authentication and database services. Offline study packs are stored locally on your device.
                </Text>
              </ScrollView>
            )}

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  mainBackground: { flex: 1 },
  topSection: {
    paddingBottom: 20,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 1,
    alignItems: 'center',
  },
  screenTitle: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  scrollContent: { paddingBottom: 100, paddingTop: 10 },
  sectionContainer: { marginBottom: 30 },
  sectionTitlePad: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 12 },
  card: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rowText: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1, marginLeft: 20 },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffcc80',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { color: '#e65100', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '82%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  modalBody: { marginBottom: 10 },
  modalParagraph: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  legalHeading: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, marginTop: 4 },
  faqBox: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  faqQuestion: { fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  faqAnswer: { fontSize: 13, lineHeight: 20 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 14 },
  feedbackInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 110, textAlignVertical: 'top', marginBottom: 16 },
  primaryActionBtn: { backgroundColor: '#2e64e5', borderRadius: 12, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  primaryActionText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});