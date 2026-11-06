import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../lib/config';
import { useAppTheme } from '../lib/ThemeContext';

type PracticeQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
};

const PRACTICE_TIMEOUT_MS = 90000;

const isValidQuestion = (q: any): q is PracticeQuestion =>
  !!q &&
  typeof q.question === 'string' &&
  Array.isArray(q.options) &&
  q.options.length >= 2 &&
  typeof q.correct_answer === 'string';

const sameAnswer = (a: string, b: string) =>
  a.trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

export default function PracticeScreen() {
  const { theme } = useAppTheme();
  const { subject, module } = useLocalSearchParams<{ subject: string, module: string }>();

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [practiceComplete, setPracticeComplete] = useState(false);

  const fetchPractice = useCallback(async () => {
    if (!subject) {
      setQuestions([]);
      setCanRetry(false);
      setErrorMessage('No subject was selected. Please go back and choose a subject.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCanRetry(true);
    setCurrentIndex(0);
    setSelectedAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setPracticeComplete(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PRACTICE_TIMEOUT_MS);

    try {
      let url = `${API_BASE_URL}/api/generate-practice?subjectTitle=${encodeURIComponent(subject)}`;
      if (module) url += `&moduleTitle=${encodeURIComponent(module)}`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('BACKEND_UNAVAILABLE');
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        if (data?.error) {
          setQuestions([]);
          setErrorMessage(
            response.status === 404
              ? "Practice questions aren't available for this module yet. Please make sure it has been uploaded."
              : "We couldn't generate your practice session right now. Please try again."
          );
          return;
        }
        throw new Error('BAD_PRACTICE_DATA');
      }

      const validQuestions = data.filter(isValidQuestion);
      if (validQuestions.length === 0) throw new Error('BAD_PRACTICE_DATA');

      setQuestions(validQuestions);
    } catch (error: any) {
      console.error('Failed to load practice questions', error);
      setQuestions([]);
      setErrorMessage(
        error?.name === 'AbortError'
          ? 'The server took too long to respond. Please try again.'
          : "We couldn't load your practice session. Check your connection and try again."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [subject, module]);

  useEffect(() => {
    fetchPractice();
  }, [fetchPractice]);

  const checkAnswer = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    setIsCorrect(sameAnswer(selectedAnswer, currentQ.correct_answer));
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
      setIsSubmitted(false);
      setIsCorrect(false);
    } else {
      setPracticeComplete(true);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>Generating Practice Session...</Text>
        <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>The first request can take up to a minute.</Text>
      </View>
    );
  }

  if (practiceComplete) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View style={[styles.successContainer, { backgroundColor: theme.bg }]}>
          <Ionicons name="barbell" size={80} color="#2e64e5" />
          <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Practice Complete!</Text>
          <Text style={[styles.successMessage, { color: theme.textSecondary }]}>You've successfully reviewed the core concepts for {module || subject}. Your gradebook remains unchanged.</Text>

          <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
            <Text style={styles.returnButtonText}>Return to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  if (errorMessage || !currentQ) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
          <Ionicons name="alert-circle-outline" size={60} color="#f44336" />
          <Text style={[styles.loadingText, { color: theme.textPrimary }]}>
            {errorMessage ?? "We couldn't load your practice session. Please try again."}
          </Text>

          {canRetry && (
            <TouchableOpacity style={[styles.returnButton, { marginTop: 30 }]} onPress={fetchPractice}>
              <Text style={styles.returnButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = (currentIndex / questions.length) * 100;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.progressBarBg, theme.isDark && { backgroundColor: '#334155' }]}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={[styles.practiceBadge, theme.isDark && { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' }]}>
          <Text style={[styles.practiceBadgeText, theme.isDark && { color: '#60a5fa' }]}>PRACTICE</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.questionCounter, { color: theme.textSecondary }]}>QUESTION {currentIndex + 1} OF {questions.length}</Text>
        <Text style={[styles.questionPrompt, { color: theme.textPrimary }]}>{currentQ.question}</Text>

        <View style={styles.optionsContainer}>
          {currentQ.options.map((opt: string, idx: number) => {
            const isThisCorrect = sameAnswer(opt, currentQ.correct_answer);
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  selectedAnswer === opt && [styles.optionSelected, theme.isDark && { backgroundColor: '#1e3a8a' }],
                  isSubmitted && selectedAnswer === opt && (isCorrect ? styles.optionCorrect : styles.optionIncorrect),
                  isSubmitted && isThisCorrect && !isCorrect && styles.optionCorrect
                ]}
                onPress={() => !isSubmitted && setSelectedAnswer(opt)}
                activeOpacity={0.7}
                disabled={isSubmitted}
              >
                <Text style={[
                  styles.optionText,
                  { color: theme.textPrimary },
                  selectedAnswer === opt && [styles.optionTextSelected, theme.isDark && { color: '#60a5fa' }],
                  isSubmitted && (isThisCorrect || selectedAnswer === opt) && { color: '#ffffff' }
                ]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
        {!isSubmitted ? (
          <TouchableOpacity
            style={[styles.submitButton, !selectedAnswer && styles.submitButtonDisabled]}
            onPress={checkAnswer}
            disabled={!selectedAnswer}
          >
            <Text style={styles.submitButtonText}>Check Answer</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.feedbackContainer}>
            <Text style={[styles.feedbackText, { color: isCorrect ? '#4caf50' : '#f44336' }]}>
              {isCorrect ? 'Great job!' : 'Review this concept.'}
            </Text>
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: isCorrect ? '#4caf50' : '#f44336' }]}
              onPress={handleNext}
            >
              <Text style={styles.submitButtonText}>
                {currentIndex === questions.length - 1 ? 'Finish Practice' : 'Next Question'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  loadingSubtext: { marginTop: 8, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  backLink: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 20 },
  backLinkText: { fontSize: 16, fontWeight: 'bold', color: '#2e64e5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  closeButton: { paddingRight: 15 },
  progressBarBg: { flex: 1, height: 12, backgroundColor: '#e0e8f9', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 6 },
  practiceBadge: { marginLeft: 15, backgroundColor: '#f0f4ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#d0ddff' },
  practiceBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#2e64e5', letterSpacing: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  questionCounter: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
  questionPrompt: { fontSize: 22, fontWeight: 'bold', lineHeight: 30, marginBottom: 30 },
  optionsContainer: { gap: 12 },
  optionButton: { padding: 18, borderRadius: 16, borderWidth: 2 },
  optionSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionText: { fontSize: 16, fontWeight: '600' },
  optionTextSelected: { color: '#2e64e5' },
  optionCorrect: { backgroundColor: '#4caf50', borderColor: '#4caf50' },
  optionIncorrect: { backgroundColor: '#f44336', borderColor: '#f44336' },
  footer: { padding: 20, borderTopWidth: 1 },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a5c0ff' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  feedbackContainer: { gap: 15 },
  feedbackText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  successTitle: { fontSize: 28, fontWeight: '900', marginTop: 20, marginBottom: 10 },
  successMessage: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  returnButton: { backgroundColor: '#2e64e5', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});