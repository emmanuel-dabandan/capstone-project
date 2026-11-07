import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/config';
import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useAppTheme } from '../lib/ThemeContext';

type QuizQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
};

const QUIZ_TIMEOUT_MS = 45000;

const isValidQuestion = (q: any): q is QuizQuestion =>
  !!q &&
  typeof q.question === 'string' &&
  Array.isArray(q.options) &&
  q.options.length >= 2 &&
  typeof q.correct_answer === 'string';

export default function QuizScreen() {
  usePreventScreenCapture();
  const { theme } = useAppTheme();

  const { subject, module } = useLocalSearchParams<{ subject: string; module?: string }>();
  const subjectTitle = subject || 'Cookery & Food Safety';
  const gradeTitle = module || subjectTitle;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState(0);

  const navigateHome = () => {
    try {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace('/home' as any);
    } catch {
      router.replace('/' as any);
    }
  };

  useEffect(() => {
    const backAction = () => {
      if (quizComplete) {
        navigateHome();
        return true;
      }
      Alert.alert('Abandon Assessment?', 'If you leave now, you will score a 0 and cannot retake it.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: navigateHome }
      ]);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [quizComplete]);

  const fetchUniqueQuiz = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setCanRetry(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QUIZ_TIMEOUT_MS);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingGrade } = await supabase
          .from('quiz_grades')
          .select('id')
          .eq('student_id', user.id)
          .in('module_title', [gradeTitle, subjectTitle])
          .maybeSingle();

        if (existingGrade) {
          setQuestions([]);
          setCanRetry(false);
          setErrorMessage('You have already recorded a grade for this assessment.');
          return;
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/api/generate-quiz?subjectTitle=${encodeURIComponent(subjectTitle)}&moduleTitle=${encodeURIComponent(gradeTitle)}`,
        { signal: controller.signal, headers: { Accept: 'application/json' } }
      );

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error('BACKEND_UNAVAILABLE');
      }

      const data = await response.json();
      const validQuestions: QuizQuestion[] = Array.isArray(data) ? data.filter(isValidQuestion) : [];
      if (validQuestions.length === 0) throw new Error('BAD_QUIZ_DATA');

      setQuestions(validQuestions);
    } catch (error: any) {
      console.error('Quiz Fetch Error:', error);
      setQuestions([]);
      setErrorMessage(
        error?.name === 'AbortError'
          ? 'The server took too long to respond. Please try again.'
          : "We couldn't load your assessment. Check your connection and try again."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [subjectTitle, gradeTitle]);

  useEffect(() => {
    fetchUniqueQuiz();
  }, [fetchUniqueQuiz]);

  const saveGrade = async (finalScore: number) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { error: insertError } = await supabase
        .from('quiz_grades')
        .insert({
          student_id: user.id,
          module_title: gradeTitle,
          score: finalScore,
          total_items: questions.length,
        });

      if (insertError) {
        if ((insertError as any).code === '23505') {
          Alert.alert('Already Completed', 'A grade is already recorded for this assessment.', [
            { text: 'OK', onPress: navigateHome }
          ]);
          return;
        }
        throw insertError;
      }

      setQuizComplete(true);
    } catch (error) {
      console.error('Grade Save Error:', error);
      Alert.alert(
        'Could not save your grade',
        'Check your connection and try again. Your answers are kept.',
        [{ text: 'Try Again', onPress: () => saveGrade(finalScore) }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (isSubmitting) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const isCorrect =
      selectedAnswer.trim().toLowerCase() === String(currentQ.correct_answer ?? '').trim().toLowerCase();
    const newScore = score + (isCorrect ? 1 : 0);
    setScore(newScore);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
    } else {
      saveGrade(newScore);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>Gemini is generating your unique assessment...</Text>
        <Text style={styles.loadingSubtext}>Screen capture is disabled.</Text>
      </View>
    );
  }

  if (quizComplete) {
    const passed = score >= (questions.length / 2);
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View style={[styles.successContainer, { backgroundColor: theme.bg }]}>
          <Ionicons name={passed ? 'checkmark-circle' : 'alert-circle'} size={80} color={passed ? '#4caf50' : '#f44336'} />
          <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Assessment Complete</Text>
          <Text style={[styles.successMessage, { color: theme.textSecondary }]}>Your permanent grade has been recorded in the ALS system.</Text>

          <View style={[styles.rewardBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.rewardLabel, { color: theme.textSecondary }]}>Final Score</Text>
            <Text style={[styles.rewardValue, { color: passed ? '#4caf50' : '#f44336' }]}>
              {score} / {questions.length}
            </Text>
          </View>

          <TouchableOpacity style={styles.returnButton} onPress={navigateHome}>
            <Text style={styles.returnButtonText}>Back to Module</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  if (errorMessage || !currentQ) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View style={[styles.errorContainer, { backgroundColor: theme.bg }]}>
          <Ionicons name="cloud-offline-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>Assessment unavailable</Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            {errorMessage ?? "We couldn't load your assessment. Please try again."}
          </Text>

          {canRetry && (
            <TouchableOpacity style={styles.returnButton} onPress={fetchUniqueQuiz}>
              <Text style={styles.returnButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backLink} onPress={navigateHome}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Alert.alert('Abandon Assessment?', 'If you leave now, you will score a 0 and cannot retake it.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: navigateHome }
          ]);
        }} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.progressBarBg, theme.isDark && { backgroundColor: '#334155' }]}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.questionCounter, { color: theme.textSecondary }]}>QUESTION {currentIndex + 1} OF {questions.length}</Text>
        <Text style={[styles.questionPrompt, { color: theme.textPrimary }]}>{currentQ.question}</Text>

        <View style={styles.optionsContainer}>
          {currentQ.options.map((opt: string, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.optionButton,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                selectedAnswer === opt && [styles.optionSelected, theme.isDark && { backgroundColor: '#1e3a8a' }]
              ]}
              onPress={() => setSelectedAnswer(opt)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                { color: theme.textPrimary },
                selectedAnswer === opt && [styles.optionTextSelected, theme.isDark && { color: '#60a5fa' }]
              ]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.submitButton, !selectedAnswer && styles.submitButtonDisabled]}
          onPress={handleNext}
          disabled={!selectedAnswer || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {currentIndex === questions.length - 1 ? 'Submit Assessment' : 'Next Question'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 20, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  loadingSubtext: { marginTop: 8, fontSize: 13, color: '#f44336', fontWeight: '600' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  errorTitle: { fontSize: 24, fontWeight: '900', marginTop: 20, marginBottom: 10 },
  errorText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  backLink: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 20 },
  backLinkText: { fontSize: 16, fontWeight: 'bold', color: '#2e64e5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  closeButton: { paddingRight: 15 },
  progressBarBg: { flex: 1, height: 12, backgroundColor: '#e0e8f9', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 6 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  questionCounter: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
  questionPrompt: { fontSize: 22, fontWeight: 'bold', lineHeight: 30, marginBottom: 30 },
  optionsContainer: { gap: 12 },
  optionButton: { padding: 18, borderRadius: 16, borderWidth: 2 },
  optionSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionText: { fontSize: 16, fontWeight: '600' },
  optionTextSelected: { color: '#2e64e5' },
  footer: { padding: 20, borderTopWidth: 1 },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a5c0ff' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  successTitle: { fontSize: 28, fontWeight: '900', marginTop: 28, marginBottom: 10 },
  successMessage: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  rewardBox: { paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, marginBottom: 40, width: '100%' },
  rewardLabel: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  rewardValue: { fontSize: 36, fontWeight: '900' },
  returnButton: { backgroundColor: '#2e64e5', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});