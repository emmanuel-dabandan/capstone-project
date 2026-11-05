import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/config';
import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';

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

  const { subject } = useLocalSearchParams<{ subject: string }>();
  const moduleTitle = subject || 'Cookery & Food Safety';

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState(0);

  // Safe navigation helper that clears history stack and lands cleanly on home
  const navigateHome = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/home' as any);
  };

  // Intercept Android hardware back button so users cannot loop back into a completed/abandoned quiz
  useEffect(() => {
    const backAction = () => {
      if (quizComplete) {
        navigateHome();
        return true;
      }
      Alert.alert("Abandon Assessment?", "If you leave now, you will score a 0 and cannot retake it.", [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: navigateHome }
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
          .eq('module_title', moduleTitle)
          .maybeSingle();

        if (existingGrade) {
          setQuestions([]);
          setCanRetry(false);
          setErrorMessage('You have already recorded a grade for this assessment.');
          return;
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/api/generate-quiz?moduleTitle=${encodeURIComponent(moduleTitle)}`,
        { signal: controller.signal, headers: { Accept: 'application/json' } }
      );

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('application/json')) {
        const preview = (await response.text()).slice(0, 120);
        console.error(`Quiz backend replied ${response.status} (${contentType}): ${preview}`);
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
  }, [moduleTitle]);

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
          module_title: moduleTitle,
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={styles.loadingText}>Gemini is generating your unique assessment...</Text>
        <Text style={styles.loadingSubtext}>Screen capture is disabled.</Text>
      </View>
    );
  }

  // RESULT SCREEN
  if (quizComplete) {
    const passed = score >= (questions.length / 2);
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <Ionicons name={passed ? "checkmark-circle" : "alert-circle"} size={80} color={passed ? "#4caf50" : "#f44336"} />
          <Text style={styles.successTitle}>Assessment Complete</Text>
          <Text style={styles.successMessage}>Your permanent grade has been recorded in the ALS system.</Text>

          <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>Final Score</Text>
            <Text style={[styles.rewardValue, { color: passed ? "#4caf50" : "#f44336" }]}>
              {score} / {questions.length}
            </Text>
          </View>

          <TouchableOpacity style={styles.returnButton} onPress={navigateHome}>
            <Text style={styles.returnButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ERROR / EMPTY SCREEN
  const currentQ = questions[currentIndex];
  if (errorMessage || !currentQ) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#aaa" />
          <Text style={styles.errorTitle}>Assessment unavailable</Text>
          <Text style={styles.errorText}>
            {errorMessage ?? "We couldn't load your assessment. Please try again."}
          </Text>

          {canRetry && (
            <TouchableOpacity style={styles.returnButton} onPress={fetchUniqueQuiz}>
              <Text style={styles.returnButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backLink} onPress={navigateHome}>
            <Text style={styles.backLinkText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Alert.alert("Abandon Assessment?", "If you leave now, you will score a 0 and cannot retake it.", [
            { text: "Stay", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: navigateHome }
          ]);
        }} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#aaa" />
        </TouchableOpacity>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.questionCounter}>QUESTION {currentIndex + 1} OF {questions.length}</Text>
        <Text style={styles.questionPrompt}>{currentQ.question}</Text>

        <View style={styles.optionsContainer}>
          {currentQ.options.map((opt: string, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.optionButton,
                selectedAnswer === opt && styles.optionSelected
              ]}
              onPress={() => setSelectedAnswer(opt)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                selectedAnswer === opt && styles.optionTextSelected
              ]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
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
  safeArea: { flex: 1, backgroundColor: '#fcfaf8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8', padding: 20 },
  loadingText: { marginTop: 20, fontSize: 16, color: '#333', fontWeight: 'bold', textAlign: 'center' },
  loadingSubtext: { marginTop: 8, fontSize: 13, color: '#f44336', fontWeight: '600' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fcfaf8' },
  errorTitle: { fontSize: 24, fontWeight: '900', color: '#333', marginTop: 20, marginBottom: 10 },
  errorText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  backLink: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 20 },
  backLinkText: { fontSize: 16, fontWeight: 'bold', color: '#2e64e5' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  closeButton: { paddingRight: 15 },
  progressBarBg: { flex: 1, height: 12, backgroundColor: '#e0e8f9', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 6 },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  questionCounter: { fontSize: 13, fontWeight: 'bold', color: '#aaa', letterSpacing: 1, marginBottom: 10 },
  questionPrompt: { fontSize: 22, fontWeight: 'bold', color: '#333', lineHeight: 30, marginBottom: 30 },

  optionsContainer: { gap: 12 },
  optionButton: { padding: 18, borderRadius: 16, borderWidth: 2, borderColor: '#e0e8f9', backgroundColor: '#ffffff' },
  optionSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#333' },
  optionTextSelected: { color: '#2e64e5' },

  footer: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f0f4ff' },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a5c0ff' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },

  successContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fcfaf8' },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#333', marginTop: 28, marginBottom: 10 },
  successMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  rewardBox: { backgroundColor: '#ffffff', paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#d0ddff', marginBottom: 40, width: '100%' },
  rewardLabel: { fontSize: 14, color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  rewardValue: { fontSize: 36, fontWeight: '900' },
  returnButton: { backgroundColor: '#2e64e5', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});