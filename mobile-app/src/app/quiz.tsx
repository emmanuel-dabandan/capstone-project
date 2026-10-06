import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';

export default function QuizScreen() {
  // 🟢 Instantly blocks screenshots and screen recordings on this screen
  usePreventScreenCapture();

  const { subject } = useLocalSearchParams<{ subject: string }>();
  const moduleTitle = subject || 'Cookery & Food Safety';

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  // Grading State
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetchUniqueQuiz();
  }, []);

  const fetchUniqueQuiz = async () => {
    try {
      // Check if they already took it first to prevent wasting API calls
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingGrade } = await supabase
          .from('quiz_grades')
          .select('id')
          .eq('student_id', user.id)
          .eq('module_title', moduleTitle)
          .single();

        if (existingGrade) {
          Alert.alert("Already Completed", "You have already recorded a grade for this assessment.");
          router.back();
          return;
        }
      }

      // Fetch the randomized Gemini quiz from your Node.js backend
      const response = await fetch(`https://glorious-happiness-x5955j7qpxqgfp4p9-3000.app.github.dev/api/generate-quiz?moduleTitle=${encodeURIComponent(moduleTitle)}`);
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const generatedQuestions = await response.json();
        setQuestions(generatedQuestions);
      } else {
        throw new Error("Backend returned HTML. Port 3000 might be private.");
      }
    } catch (error) {
      console.error("Quiz Fetch Error:", error);
      Alert.alert("Error", "Could not generate assessment. Please try again.");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    const currentQ = questions[currentIndex];
    
    // Check answer silently (no immediate red/green feedback for formal assessments)
    let currentScore = score;
    if (selectedAnswer.trim().toLowerCase() === currentQ.correct_answer.trim().toLowerCase()) {
      currentScore += 1;
      setScore(currentScore);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
    } else {
      // Submit Final Grade
      setIsSubmitting(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: insertError } = await supabase
            .from('quiz_grades')
            .insert({ 
              student_id: user.id, 
              module_title: moduleTitle,
              score: currentScore,
              total_items: questions.length
            });

          if (insertError) {
            console.error("Grade Save Error:", insertError);
            Alert.alert("Database Error", "Could not save your grade. You may have already taken this.");
            router.back();
            return;
          }
        }
      } catch (error) {
        console.error("Submission Error:", error);
      } finally {
        setIsSubmitting(false);
        setQuizComplete(true);
      }
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

  // 🏆 RESULT SCREEN
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

          <TouchableOpacity style={styles.returnButton} onPress={() => router.replace('/learn' as any)}>
            <Text style={styles.returnButtonText}>Return to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 🎮 QUIZ SCREEN
  const currentQ = questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Alert.alert("Abandon Assessment?", "If you leave now, you will score a 0 and cannot retake it.", [
            { text: "Stay", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: () => router.back() }
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
          {currentQ.options?.map((opt: string, idx: number) => (
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
  
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fcfaf8' },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#333', marginTop: 20, marginBottom: 10 },
  successMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  rewardBox: { backgroundColor: '#ffffff', paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#d0ddff', marginBottom: 40, width: '100%' },
  rewardLabel: { fontSize: 14, color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  rewardValue: { fontSize: 36, fontWeight: '900' },
  returnButton: { backgroundColor: '#2e64e5', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});