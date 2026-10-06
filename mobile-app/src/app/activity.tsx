import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function ActivityScreen() {
  const { lessonData } = useLocalSearchParams();
  const [lesson, setLesson] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);

  // Universal Game State
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Specific State for Matching Game
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  useEffect(() => {
    if (lessonData) {
      try {
        const parsed = JSON.parse(lessonData as string);
        setLesson(parsed);
        if (parsed.activity) {
          setActivity(parsed.activity);
        }
      } catch (e) {
        console.error("Failed to parse lesson data", e);
      }
    }
  }, [lessonData]);

  if (!activity) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Activity...</Text>
      </SafeAreaView>
    );
  }

  const checkAnswer = async () => {
    let correct = false;

    if (activity.activity_type === 'matching') {
      // Check if all pairs match exactly
      const allCorrect = activity.matching_pairs.every(
        (pair: any) => matchedPairs[pair.term] === pair.definition
      );
      correct = allCorrect && Object.keys(matchedPairs).length === activity.matching_pairs.length;
    } else {
      // For all other types, compare strings (case insensitive)
      correct = userAnswer.trim().toLowerCase() === activity.correct_answer.trim().toLowerCase();
    }

    setIsCorrect(correct);
    setIsSubmitted(true);

    if (correct) {
      // 1. Get the current logged in user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 2. Fetch their current XP
        const { data: profile } = await supabase
          .from('students')
          .select('xp')
          .eq('id', user.id)
          .single();
          
        const currentXp = profile?.xp || 0;
        const newXp = currentXp + 50; // Award 50 XP per correct activity
        await supabase.from('notifications').insert({
  student_id: user.id,
  message: `Great job! You mastered ${lesson.lesson_title} and earned 50 XP.`,
  type: 'completion'
});
        // 3. Save the new XP back to the database
        await supabase
          .from('students')
          .update({ xp: newXp })
          .eq('id', user.id);
          
        // Optional: Update the lesson progress to 100% so the padlock unlocks
        await supabase
          .from('ai_lessons')
          .update({ progress: 100 })
          .eq('title', lesson.lesson_title);
      }
    }
  };

  const handleContinue = () => {
    // Option B: Route back to the module overview to show progress
    router.back();
    // You could also route to the dashboard: router.replace('/dashboard');
  };

  // --- RENDER HELPERS FOR EACH ACTIVITY TYPE ---

  const renderMultipleChoice = () => (
    <View style={styles.optionsContainer}>
      {activity.options?.map((option: string, index: number) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.optionCard,
            userAnswer === option && styles.optionCardSelected,
            isSubmitted && option === activity.correct_answer && styles.optionCardCorrect,
            isSubmitted && userAnswer === option && option !== activity.correct_answer && styles.optionCardWrong
          ]}
          onPress={() => !isSubmitted && setUserAnswer(option)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.optionText,
            userAnswer === option && styles.optionTextSelected,
            isSubmitted && option === activity.correct_answer && styles.optionTextCorrect
          ]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTrueFalse = () => (
    <View style={styles.optionsContainer}>
      {['True', 'False'].map((option) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.optionCard,
            userAnswer === option && styles.optionCardSelected,
            isSubmitted && option === activity.correct_answer && styles.optionCardCorrect,
            isSubmitted && userAnswer === option && option !== activity.correct_answer && styles.optionCardWrong
          ]}
          onPress={() => !isSubmitted && setUserAnswer(option)}
        >
          <Text style={[styles.optionText, userAnswer === option && styles.optionTextSelected]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFillInBlanks = () => (
    <View style={styles.inputContainer}>
      <TextInput
        style={[
          styles.textInput,
          isSubmitted && isCorrect && styles.inputCorrect,
          isSubmitted && !isCorrect && styles.inputWrong
        ]}
        placeholder="Type your answer here..."
        placeholderTextColor="#999"
        value={userAnswer}
        onChangeText={setUserAnswer}
        editable={!isSubmitted}
        autoCapitalize="none"
      />
    </View>
  );

  const renderDragAndDrop = () => {
    // "Tap to Place" logic. Tapping a chip sets it as the answer.
    const sentenceParts = activity.question_prompt.split('____');
    
    return (
      <View>
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {sentenceParts[0]}
            <Text style={[styles.blankSpace, userAnswer && styles.filledBlank]}>
              {userAnswer ? ` ${userAnswer} ` : ' _______ '}
            </Text>
            {sentenceParts[1]}
          </Text>
        </View>

        <Text style={styles.instructionText}>Tap a word below to fill the blank:</Text>
        
        <View style={styles.wordBank}>
          {activity.options?.map((word: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.wordChip,
                userAnswer === word && styles.wordChipSelected
              ]}
              onPress={() => !isSubmitted && setUserAnswer(word)}
            >
              <Text style={[styles.wordChipText, userAnswer === word && styles.wordChipTextSelected]}>
                {word}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderMatching = () => {
    // Left column: Terms. Right column: Definitions.
    // Tap a term, then tap a definition to link them.
    return (
      <View style={styles.matchingContainer}>
        <Text style={styles.instructionText}>Step 1: Tap a Term. Step 2: Tap its Definition.</Text>
        
        <View style={styles.matchingColumns}>
          {/* TERMS COLUMN */}
          <View style={styles.column}>
            <Text style={styles.columnHeader}>Terms</Text>
            {activity.matching_pairs?.map((pair: any, index: number) => {
              const isMatched = !!matchedPairs[pair.term];
              const isSelected = selectedTerm === pair.term;
              
              return (
                <TouchableOpacity
                  key={`term-${index}`}
                  style={[
                    styles.matchCard,
                    isSelected && styles.matchCardSelected,
                    isMatched && styles.matchCardMatched
                  ]}
                  onPress={() => !isSubmitted && !isMatched && setSelectedTerm(pair.term)}
                >
                  <Text style={[styles.matchText, (isSelected || isMatched) && styles.matchTextSelected]}>
                    {pair.term}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* DEFINITIONS COLUMN */}
          <View style={styles.column}>
            <Text style={styles.columnHeader}>Definitions</Text>
            {activity.matching_pairs?.map((pair: any, index: number) => {
              // Check if this definition is currently assigned to any term
              const matchedTerm = Object.keys(matchedPairs).find(term => matchedPairs[term] === pair.definition);
              
              return (
                <TouchableOpacity
                  key={`def-${index}`}
                  style={[
                    styles.matchCard,
                    matchedTerm && styles.matchCardMatched
                  ]}
                  onPress={() => {
                    if (!isSubmitted && selectedTerm && !matchedTerm) {
                      setMatchedPairs(prev => ({ ...prev, [selectedTerm]: pair.definition }));
                      setSelectedTerm(null); // Reset selection after pairing
                    }
                  }}
                >
                  <Text style={[styles.matchText, matchedTerm && styles.matchTextSelected]}>
                    {matchedTerm ? `Matched to: ${matchedTerm}` : pair.definition}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        {!isSubmitted && Object.keys(matchedPairs).length > 0 && (
          <TouchableOpacity style={styles.resetButton} onPress={() => setMatchedPairs({})}>
            <Text style={styles.resetButtonText}>Reset Pairs</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Knowledge Check</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* PROGRESS PILL */}
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{activity.activity_type.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>

        {/* PROMPT */}
        <Text style={styles.promptText}>
          {activity.activity_type === 'drag_and_drop' ? "Complete the sentence:" : activity.question_prompt}
        </Text>

        {/* ACTIVITY MECHANICS ROUTER */}
        <View style={styles.gameBoard}>
          {activity.activity_type === 'multiple_choice' && renderMultipleChoice()}
          {activity.activity_type === 'true_false' && renderTrueFalse()}
          {activity.activity_type === 'fill_in_blanks' && renderFillInBlanks()}
          {activity.activity_type === 'drag_and_drop' && renderDragAndDrop()}
          {activity.activity_type === 'matching' && renderMatching()}
        </View>

        {/* FEEDBACK STATE */}
        {isSubmitted && (
          <View style={[styles.feedbackBanner, isCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <Ionicons name={isCorrect ? "checkmark-circle" : "close-circle"} size={24} color={isCorrect ? "#155724" : "#721c24"} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[styles.feedbackTitle, isCorrect ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                {isCorrect ? "Excellent Work!" : "Not quite right."}
              </Text>
              {!isCorrect && activity.activity_type !== 'matching' && (
                <Text style={styles.feedbackSubtitle}>The correct answer was: {activity.correct_answer}</Text>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {/* FOOTER ACTIONS */}
      <View style={styles.footer}>
        {!isSubmitted ? (
          <TouchableOpacity 
            style={[styles.submitButton, !userAnswer && Object.keys(matchedPairs).length === 0 && styles.submitButtonDisabled]}
            activeOpacity={0.8}
            onPress={checkAnswer}
            disabled={!userAnswer && Object.keys(matchedPairs).length === 0}
          >
            <Text style={styles.submitButtonText}>Check Answer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.submitButton, isCorrect ? styles.continueButton : styles.retryButton]}
            activeOpacity={0.8}
            onPress={() => isCorrect ? handleContinue() : setIsSubmitted(false)}
          >
            <Text style={styles.submitButtonText}>{isCorrect ? "Continue Learning" : "Try Again"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fcfaf8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fcfaf8' },
  loadingText: { fontSize: 16, color: '#666' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#382314' },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  badgeContainer: { backgroundColor: '#e0e8f9', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 20 },
  badgeText: { color: '#2e64e5', fontSize: 12, fontWeight: 'bold' },
  
  promptText: { fontSize: 22, fontWeight: 'bold', color: '#382314', marginBottom: 30, lineHeight: 30 },
  
  gameBoard: { marginBottom: 30 },
  
  optionsContainer: { gap: 12 },
  optionCard: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e0d8d0', borderRadius: 16, padding: 18 },
  optionCardSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionCardCorrect: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  optionCardWrong: { borderColor: '#f44336', backgroundColor: '#ffebee' },
  
  optionText: { fontSize: 16, color: '#333', fontWeight: '500' },
  optionTextSelected: { color: '#2e64e5', fontWeight: 'bold' },
  optionTextCorrect: { color: '#2e7d32', fontWeight: 'bold' },

  inputContainer: { width: '100%' },
  textInput: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e0d8d0', borderRadius: 16, padding: 20, fontSize: 18, color: '#333' },
  inputCorrect: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  inputWrong: { borderColor: '#f44336', backgroundColor: '#ffebee' },

  sentenceContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e0d8d0', marginBottom: 20 },
  sentenceText: { fontSize: 20, lineHeight: 32, color: '#333' },
  blankSpace: { color: '#999', textDecorationLine: 'underline' },
  filledBlank: { color: '#2e64e5', fontWeight: 'bold', textDecorationLine: 'none' },
  instructionText: { fontSize: 14, color: '#666', marginBottom: 10, fontStyle: 'italic' },
  
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wordChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d0ddff', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  wordChipSelected: { backgroundColor: '#2e64e5', borderColor: '#2e64e5' },
  wordChipText: { fontSize: 16, color: '#2e64e5', fontWeight: '600' },
  wordChipTextSelected: { color: '#ffffff' },

  matchingContainer: { flex: 1 },
  matchingColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  column: { flex: 1, gap: 10 },
  columnHeader: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5, textAlign: 'center' },
  matchCard: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e0d8d0', borderRadius: 12, padding: 15, minHeight: 70, justifyContent: 'center', alignItems: 'center' },
  matchCardSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  matchCardMatched: { borderColor: '#4caf50', backgroundColor: '#e8f5e9', opacity: 0.8 },
  matchText: { fontSize: 14, color: '#333', textAlign: 'center', fontWeight: '500' },
  matchTextSelected: { color: '#2e64e5', fontWeight: 'bold' },
  resetButton: { marginTop: 20, padding: 10, alignSelf: 'center' },
  resetButtonText: { color: '#f44336', fontWeight: 'bold' },

  feedbackBanner: { flexDirection: 'row', alignItems: 'flex-start', padding: 15, borderRadius: 12, marginTop: 10 },
  feedbackCorrect: { backgroundColor: '#d4edda', borderWidth: 1, borderColor: '#c3e6cb' },
  feedbackWrong: { backgroundColor: '#f8d7da', borderWidth: 1, borderColor: '#f5c6cb' },
  feedbackTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  feedbackTextCorrect: { color: '#155724' },
  feedbackTextWrong: { color: '#721c24' },
  feedbackSubtitle: { fontSize: 14, color: '#721c24' },

  footer: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e0d8d0' },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a0b9c1' },
  continueButton: { backgroundColor: '#4caf50' },
  retryButton: { backgroundColor: '#f44336' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});