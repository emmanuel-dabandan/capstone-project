import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/ThemeContext';

const { width } = Dimensions.get('window');

const fallbackQuestions = [
  { activity_type: 'multiple_choice', question_prompt: 'What is the primary purpose of a firewall?', options: ['Cooking', 'Network Security', 'Painting', 'Data Storage'], correct_answer: 'Network Security' },
  { activity_type: 'true_false', question_prompt: 'HTML stands for HyperText Markup Language.', options: ['True', 'False'], correct_answer: 'True' },
  { activity_type: 'fill_in_blanks', question_prompt: 'The brain of the computer is called the _____.', correct_answer: 'CPU' }
];

export default function GauntletScreen() {
  const { theme } = useAppTheme();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [gauntletComplete, setGauntletComplete] = useState(false);

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    fetchGauntletQuestions();
  }, []);

  const fetchGauntletQuestions = async () => {
    try {
      const { data: lessonsData } = await supabase.from('ai_lessons').select('parsed_content');
      let allActivities: any[] = [];

      if (lessonsData && lessonsData.length > 0) {
        lessonsData.forEach(row => {
          const content = row.parsed_content;
          if (content && content.lessons) {
            content.lessons.forEach((lesson: any) => {
              if (lesson.activity) {
                allActivities.push(lesson.activity);
              }
            });
          }
        });
      }

      let selected = allActivities.length > 0 ? allActivities : fallbackQuestions;
      selected = selected.sort(() => 0.5 - Math.random()).slice(0, 3);
      setQuestions(selected);
    } catch (error) {
      console.error("Error fetching gauntlet:", error);
      setQuestions(fallbackQuestions);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAnswer = () => {
    const currentQ = questions[currentIndex];
    const rawCorrect = currentQ.correct_answer ?? currentQ.answer ?? currentQ.correctAnswer ?? "";
    const normalizedSelected = String(selectedAnswer || "").trim().toLowerCase();
    const normalizedCorrect = String(rawCorrect).trim().toLowerCase();
    const correct = (normalizedSelected === normalizedCorrect) && (normalizedCorrect !== "");

    setIsCorrect(correct);
    setIsSubmitted(true);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
      setIsSubmitted(false);
      setIsCorrect(false);
    } else {
      setIsFinishing(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('students').select('xp').eq('id', user.id).single();
          const currentXp = profile?.xp || 0;
          const todayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

          const { error: updateError } = await supabase
            .from('students')
            .update({
              xp: currentXp + 150,
              last_challenge_date: todayPHT
            })
            .eq('id', user.id);

          if (updateError) {
            console.error("SUPABASE UPDATE FAILED:", updateError);
            alert(`Database Error: ${updateError.message}`);
            setIsFinishing(false);
            return;
          }

          await supabase.rpc('log_daily_xp', { p_student_id: user.id, p_xp: 150 });
        }
      } catch (error) {
        console.error("Error saving gauntlet progress:", error);
      } finally {
        setIsFinishing(false);
        setGauntletComplete(true);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Constructing your Gauntlet...</Text>
      </View>
    );
  }

  if (gauntletComplete) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View style={[styles.successContainer, { backgroundColor: theme.bg }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="flame" size={60} color="#ff9800" />
          </View>
          <Text style={[styles.successTitle, { color: theme.textPrimary }]}>Gauntlet Cleared!</Text>
          <Text style={[styles.successMessage, { color: theme.textSecondary }]}>You reviewed 3 concepts, strengthened your memory, and secured your daily streak.</Text>

          <View style={[styles.rewardBox, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <Text style={[styles.rewardLabel, { color: theme.textSecondary }]}>Reward Earned</Text>
            <Text style={styles.rewardValue}>+150 XP</Text>
          </View>

          <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
            <Text style={styles.returnButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  const progressPercent = ((currentIndex) / questions.length) * 100;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.progressBarBg, theme.isDark && { backgroundColor: '#334155' }]}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.questionCounter, { color: theme.textSecondary }]}>QUESTION {currentIndex + 1} OF {questions.length}</Text>
        <Text style={[styles.questionPrompt, { color: theme.textPrimary }]}>{currentQ.question_prompt}</Text>

        {(currentQ.activity_type === 'multiple_choice' || currentQ.activity_type === 'true_false' || currentQ.options) ? (
          <View style={styles.optionsContainer}>
            {currentQ.options?.map((opt: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  selectedAnswer === opt && [styles.optionSelected, theme.isDark && { backgroundColor: '#1e3a8a' }],
                  isSubmitted && selectedAnswer === opt && (isCorrect ? styles.optionCorrect : styles.optionIncorrect),
                  isSubmitted && opt === currentQ.correct_answer && !isCorrect && styles.optionCorrect
                ]}
                onPress={() => !isSubmitted && setSelectedAnswer(opt)}
                activeOpacity={0.7}
                disabled={isSubmitted}
              >
                <Text style={[
                  styles.optionText,
                  { color: theme.textPrimary },
                  selectedAnswer === opt && [styles.optionTextSelected, theme.isDark && { color: '#60a5fa' }],
                  isSubmitted && (opt === currentQ.correct_answer || selectedAnswer === opt) && { color: '#ffffff' }
                ]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary },
                isSubmitted && (isCorrect ? styles.inputCorrect : styles.inputIncorrect)
              ]}
              placeholder="Type your answer here..."
              placeholderTextColor={theme.textSecondary}
              value={selectedAnswer}
              onChangeText={setSelectedAnswer}
              editable={!isSubmitted}
              autoCapitalize="none"
            />
            {isSubmitted && !isCorrect && (
              <Text style={styles.correctionText}>Correct answer: {currentQ.correct_answer}</Text>
            )}
          </View>
        )}
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
              {isCorrect ? 'Excellent!' : 'Not quite right.'}
            </Text>
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: isCorrect ? '#4caf50' : '#f44336' }]}
              onPress={handleNext}
              disabled={isFinishing}
            >
              {isFinishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {currentIndex === questions.length - 1 ? 'Finish Gauntlet' : 'Next Question'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: '500' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  closeButton: { paddingRight: 15 },
  progressBarBg: { flex: 1, height: 12, backgroundColor: '#e0e8f9', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 6 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  questionCounter: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
  questionPrompt: { fontSize: 24, fontWeight: 'bold', lineHeight: 32, marginBottom: 30 },
  optionsContainer: { gap: 12 },
  optionButton: { padding: 18, borderRadius: 16, borderWidth: 2 },
  optionSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionText: { fontSize: 16, fontWeight: '600' },
  optionTextSelected: { color: '#2e64e5' },
  optionCorrect: { backgroundColor: '#4caf50', borderColor: '#4caf50' },
  optionIncorrect: { backgroundColor: '#f44336', borderColor: '#f44336' },
  inputContainer: { marginTop: 10 },
  textInput: { borderWidth: 2, borderRadius: 16, padding: 20, fontSize: 18, fontWeight: '500' },
  inputCorrect: { borderColor: '#4caf50', color: '#4caf50' },
  inputIncorrect: { borderColor: '#f44336', color: '#f44336' },
  correctionText: { marginTop: 10, fontSize: 15, color: '#f44336', fontWeight: '600' },
  footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 0 : 20, borderTopWidth: 1 },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a5c0ff' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  feedbackContainer: { gap: 15 },
  feedbackText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff3e0', justifyContent: 'center', alignItems: 'center', marginBottom: 25, elevation: 5, shadowColor: '#ff9800', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  successTitle: { fontSize: 32, fontWeight: '900', marginBottom: 15 },
  successMessage: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  rewardBox: { paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, marginBottom: 40, width: '100%' },
  rewardLabel: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  rewardValue: { fontSize: 36, fontWeight: '900', color: '#fbc02d' },
  returnButton: { backgroundColor: '#2e64e5', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});