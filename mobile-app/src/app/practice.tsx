import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PracticeScreen() {
  const { subject, module } = useLocalSearchParams<{ subject: string, module: string }>();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [practiceComplete, setPracticeComplete] = useState(false);

  useEffect(() => {
    const fetchPractice = async () => {
      try {
        // 🟢 FIXED: Now passes BOTH subjectTitle and moduleTitle
        const response = await fetch(`https://glorious-happiness-x5955j7qpxqgfp4p9-3000.app.github.dev/api/generate-practice?subjectTitle=${encodeURIComponent(subject as string)}&moduleTitle=${encodeURIComponent(module as string)}`);
        const data = await response.json();
        
        // 🟢 FIXED: Check for backend errors
        if (data.error) {
          console.warn("Module not ready:", data.error);
          setQuestions([]);
        } else {
          setQuestions(data);
        }
      } catch (error) {
        console.error("Failed to load practice questions", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPractice();
  }, [subject, module]);

  const checkAnswer = () => {
    const currentQ = questions[currentIndex];
    const correct = selectedAnswer === currentQ.correct_answer;
    setIsCorrect(correct);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={styles.loadingText}>Generating Practice Session...</Text>
      </View>
    );
  }

  // 🟢 Safety fallback if Gemini returns empty or errors out
  if (!Array.isArray(questions) || questions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#f44336" />
        <Text style={styles.loadingText}>No practice questions could be generated. Please ensure this specific module has been uploaded!</Text>
        <TouchableOpacity style={[styles.returnButton, { marginTop: 30, paddingHorizontal: 30 }]} onPress={() => router.back()}>
          <Text style={styles.returnButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (practiceComplete) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <Ionicons name="barbell" size={80} color="#2e64e5" />
          <Text style={styles.successTitle}>Practice Complete!</Text>
          <Text style={styles.successMessage}>You've successfully reviewed the core concepts for {module || subject}. Your gradebook remains unchanged.</Text>
          
          <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
            <Text style={styles.returnButtonText}>Return to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  const progressPercent = ((currentIndex) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#aaa" />
        </TouchableOpacity>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={styles.practiceBadge}>
          <Text style={styles.practiceBadgeText}>PRACTICE</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.questionCounter}>QUESTION {currentIndex + 1} OF {questions.length}</Text>
        <Text style={styles.questionPrompt}>{currentQ?.question}</Text>

        <View style={styles.optionsContainer}>
          {currentQ?.options?.map((opt: string, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.optionButton,
                selectedAnswer === opt && styles.optionSelected,
                isSubmitted && selectedAnswer === opt && (isCorrect ? styles.optionCorrect : styles.optionIncorrect),
                isSubmitted && opt === currentQ.correct_answer && !isCorrect && styles.optionCorrect
              ]}
              onPress={() => !isSubmitted && setSelectedAnswer(opt)}
              activeOpacity={0.7}
              disabled={isSubmitted}
            >
              <Text style={[
                styles.optionText,
                selectedAnswer === opt && styles.optionTextSelected,
                isSubmitted && (opt === currentQ.correct_answer || selectedAnswer === opt) && { color: '#ffffff' }
              ]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
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
  safeArea: { flex: 1, backgroundColor: '#fcfaf8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8', padding: 30 },
  loadingText: { marginTop: 15, fontSize: 16, color: '#666', fontWeight: 'bold', textAlign: 'center' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  closeButton: { paddingRight: 15 },
  progressBarBg: { flex: 1, height: 12, backgroundColor: '#e0e8f9', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 6 },
  practiceBadge: { marginLeft: 15, backgroundColor: '#f0f4ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#d0ddff' },
  practiceBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#2e64e5', letterSpacing: 1 },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  questionCounter: { fontSize: 13, fontWeight: 'bold', color: '#aaa', letterSpacing: 1, marginBottom: 10 },
  questionPrompt: { fontSize: 22, fontWeight: 'bold', color: '#333', lineHeight: 30, marginBottom: 30 },

  optionsContainer: { gap: 12 },
  optionButton: { padding: 18, borderRadius: 16, borderWidth: 2, borderColor: '#e0e8f9', backgroundColor: '#ffffff' },
  optionSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#333' },
  optionTextSelected: { color: '#2e64e5' },
  optionCorrect: { backgroundColor: '#4caf50', borderColor: '#4caf50' },
  optionIncorrect: { backgroundColor: '#f44336', borderColor: '#f44336' },

  footer: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f0f4ff' },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a5c0ff' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  
  feedbackContainer: { gap: 15 },
  feedbackText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fcfaf8' },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#333', marginTop: 20, marginBottom: 10 },
  successMessage: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  returnButton: { backgroundColor: '#2e64e5', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  returnButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});