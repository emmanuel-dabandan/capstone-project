import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput } from 'react-native';
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

  // Robust answer validator that handles letters (A/B/C/D), numbers, and full text
  // 🟢 Ultra-forgiving answer validator
  const isAnswerCorrect = (userAns: string, act: any): boolean => {
    if (!act) return false;
    const rawCorrect = act.correct_answer ?? act.answer ?? act.correctAnswer ?? act.correct;
    if (rawCorrect === undefined || rawCorrect === null) return false;

    // Helper: Strips all punctuation, spaces, and prefixes so "Answer!" and "answer " match perfectly
    const superClean = (str: string) => 
      String(str || '')
        .replace(/^(option\s+[a-d]|option\s+\d|[a-d][.)\-:]|\d+[.)\-:])\s*/i, '') // Remove "A. "
        .replace(/[^a-z0-9]/gi, '') // Remove everything except raw letters and numbers
        .toLowerCase();

    const cleanUser = superClean(userAns);
    const cleanCorrect = superClean(rawCorrect);

    // 1. Direct or partial match on the stripped text
    if (cleanUser && cleanCorrect && (cleanUser === cleanCorrect || cleanUser.includes(cleanCorrect) || cleanCorrect.includes(cleanUser))) {
      return true;
    }

    // 2. Match by option letter or index (e.g. correct_answer is "B" or "2")
    if (Array.isArray(act.options)) {
      const letters = ['a', 'b', 'c', 'd', 'e'];
      
      const userIdx = act.options.findIndex(
        (opt: string) => superClean(opt) === cleanUser
      );

      if (userIdx !== -1) {
        const letter = letters[userIdx];
        const num = String(userIdx + 1);
        if (cleanCorrect === letter || cleanCorrect === `option${letter}` || cleanCorrect === num) {
          return true;
        }
      }

      const correctLetterIdx = letters.indexOf(cleanCorrect);
      if (correctLetterIdx !== -1 && act.options[correctLetterIdx]) {
        if (cleanUser === superClean(act.options[correctLetterIdx])) return true;
      }

      const numIdx = parseInt(cleanCorrect, 10) - 1;
      if (!isNaN(numIdx) && act.options[numIdx]) {
        if (cleanUser === superClean(act.options[numIdx])) return true;
      }
    }

    return false;
  };

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
      const allCorrect =
        Array.isArray(activity.matching_pairs) &&
        activity.matching_pairs.length > 0 &&
        activity.matching_pairs.every(
          (pair: any) => matchedPairs[pair.term] === pair.definition
        );
      correct = Boolean(allCorrect && Object.keys(matchedPairs).length === activity.matching_pairs.length);
    } else {
      correct = isAnswerCorrect(userAnswer, activity);
    }

    // 🟢 TEMPORARY DEV BYPASS: FORCE WIN TO TEST ROUTING

    setIsCorrect(correct);
    setIsSubmitted(true);
    // ... rest of the function

    if (correct) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 1. SAFELY UPDATE XP
        try {
          const { data: profile } = await supabase
            .from('students')
            .select('xp')
            .eq('id', user.id)
            .single();

          const newXp = (profile?.xp || 0) + 50;
          await supabase.from('students').update({ xp: newXp }).eq('id', user.id);
        } catch (err) {
          console.error("XP Update Failed:", err);
        }

        // 2. SAFELY UPDATE LESSON PROGRESS
        try {
          // Find the parent module that contains this specific lesson
          const { data: allModules } = await supabase.from('ai_lessons').select('id, progress, parsed_content');
          const parentMod = allModules?.find(m => 
            m.parsed_content?.lessons?.some((l: any) => l.lesson_title === lesson?.lesson_title)
          );

          if (parentMod) {
             const totalLessonsInModule = parentMod.parsed_content.lessons.length || 1;
             const progressIncrement = Math.round(100 / totalLessonsInModule);
             const newProgress = Math.min(100, (parentMod.progress || 0) + progressIncrement);
             
             await supabase.from('ai_lessons').update({ progress: newProgress }).eq('id', parentMod.id);
          }
        } catch (err) {
          console.error("Progress Update Failed:", err);
        }

        // 3. SAFELY INSERT NOTIFICATION
        try {
          await supabase.from('notifications').insert({
            student_id: user.id,
            message: `Great job! You mastered a lesson and earned 50 XP.`,
            type: 'new_module'
          });
        } catch (err) {
          console.error("Notification Insert Failed:", err);
        }
      }
    }
  };

  const handleContinue = () => {
    // 🟢 Reroute to the dashboard to force the XP and progress bars to refresh visually
    router.replace('/dashboard' as any);
  };

  // --- RENDER HELPERS ---

  const renderMultipleChoice = () => (
    <View style={styles.optionsContainer}>
      {activity.options?.map((option: string, index: number) => {
        const isSelected = userAnswer === option;
        const isThisOptionCorrect = isAnswerCorrect(option, activity);

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionCard,
              isSelected && styles.optionCardSelected,
              isSubmitted && isThisOptionCorrect && styles.optionCardCorrect,
              isSubmitted && isSelected && !isThisOptionCorrect && styles.optionCardWrong,
            ]}
            onPress={() => !isSubmitted && setUserAnswer(option)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
                isSubmitted && isThisOptionCorrect && styles.optionTextCorrect,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderTrueFalse = () => (
    <View style={styles.optionsContainer}>
      {['True', 'False'].map((option) => {
        const isSelected = userAnswer === option;
        const isThisOptionCorrect = isAnswerCorrect(option, activity);

        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionCard,
              isSelected && styles.optionCardSelected,
              isSubmitted && isThisOptionCorrect && styles.optionCardCorrect,
              isSubmitted && isSelected && !isThisOptionCorrect && styles.optionCardWrong,
            ]}
            onPress={() => !isSubmitted && setUserAnswer(option)}
          >
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
                isSubmitted && isThisOptionCorrect && styles.optionTextCorrect,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFillInBlanks = () => (
    <View style={styles.inputContainer}>
      <TextInput
        style={[
          styles.textInput,
          isSubmitted && isCorrect && styles.inputCorrect,
          isSubmitted && !isCorrect && styles.inputWrong,
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
    const prompt = activity.question_prompt || '';
    const sentenceParts = prompt.includes('____') ? prompt.split('____') : [prompt, ''];

    return (
      <View>
        <View style={styles.sentenceContainer}>
          <Text style={styles.sentenceText}>
            {sentenceParts[0]}
            <Text style={[styles.blankSpace, userAnswer ? styles.filledBlank : null]}>
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
              style={[styles.wordChip, userAnswer === word && styles.wordChipSelected]}
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

  const renderMatching = () => (
    <View style={styles.matchingContainer}>
      <Text style={styles.instructionText}>Step 1: Tap a Term. Step 2: Tap its Definition.</Text>

      <View style={styles.matchingColumns}>
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
                  isMatched && styles.matchCardMatched,
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

        <View style={styles.column}>
          <Text style={styles.columnHeader}>Definitions</Text>
          {activity.matching_pairs?.map((pair: any, index: number) => {
            const matchedTerm = Object.keys(matchedPairs).find(
              (term) => matchedPairs[term] === pair.definition
            );

            return (
              <TouchableOpacity
                key={`def-${index}`}
                style={[styles.matchCard, matchedTerm && styles.matchCardMatched]}
                onPress={() => {
                  if (!isSubmitted && selectedTerm && !matchedTerm) {
                    setMatchedPairs((prev) => ({ ...prev, [selectedTerm]: pair.definition }));
                    setSelectedTerm(null);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
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
          <Text style={styles.badgeText}>
            {activity.activity_type ? activity.activity_type.replace(/_/g, ' ').toUpperCase() : 'ACTIVITY'}
          </Text>
        </View>

        {/* PROMPT */}
        <Text style={styles.promptText}>
          {activity.activity_type === 'drag_and_drop'
            ? 'Complete the sentence:'
            : activity.question_prompt}
        </Text>

        {/* ACTIVITY MECHANICS */}
        <View style={styles.gameBoard}>
          {activity.activity_type === 'multiple_choice' && renderMultipleChoice()}
          {activity.activity_type === 'true_false' && renderTrueFalse()}
          {activity.activity_type === 'fill_in_blanks' && renderFillInBlanks()}
          {activity.activity_type === 'drag_and_drop' && renderDragAndDrop()}
          {activity.activity_type === 'matching' && renderMatching()}
        </View>

        {/* FEEDBACK BANNER */}
        {isSubmitted && (
          <View style={[styles.feedbackBanner, isCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={isCorrect ? '#155724' : '#721c24'}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[styles.feedbackTitle, isCorrect ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                {isCorrect ? 'Excellent Work!' : 'Not quite right.'}
              </Text>
              {!isCorrect && activity.activity_type !== 'matching' && (
                <Text style={styles.feedbackSubtitle}>
                  The correct answer was: {String(activity.correct_answer ?? activity.answer ?? '')}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* FOOTER ACTIONS */}
      <View style={styles.footer}>
        {!isSubmitted ? (
          <TouchableOpacity
            style={[
              styles.submitButton,
              !userAnswer && Object.keys(matchedPairs).length === 0 && styles.submitButtonDisabled,
            ]}
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
            onPress={() => (isCorrect ? handleContinue() : setIsSubmitted(false))}
          >
            <Text style={styles.submitButtonText}>{isCorrect ? 'Continue Learning' : 'Try Again'}</Text>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#382314' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },

  badgeContainer: {
    backgroundColor: '#e0e8f9',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeText: { color: '#2e64e5', fontSize: 12, fontWeight: 'bold' },

  promptText: { fontSize: 20, fontWeight: 'bold', color: '#382314', marginBottom: 24, lineHeight: 28 },

  gameBoard: { marginBottom: 24 },

  optionsContainer: { gap: 12 },
  optionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0d8d0',
    borderRadius: 16,
    padding: 18,
  },
  optionCardSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionCardCorrect: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  optionCardWrong: { borderColor: '#f44336', backgroundColor: '#ffebee' },

  optionText: { fontSize: 16, color: '#333', fontWeight: '500', lineHeight: 22 },
  optionTextSelected: { color: '#2e64e5', fontWeight: 'bold' },
  optionTextCorrect: { color: '#2e7d32', fontWeight: 'bold' },

  inputContainer: { width: '100%' },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0d8d0',
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    color: '#333',
  },
  inputCorrect: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  inputWrong: { borderColor: '#f44336', backgroundColor: '#ffebee' },

  sentenceContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0d8d0',
    marginBottom: 20,
  },
  sentenceText: { fontSize: 18, lineHeight: 28, color: '#333' },
  blankSpace: { color: '#999', textDecorationLine: 'underline' },
  filledBlank: { color: '#2e64e5', fontWeight: 'bold', textDecorationLine: 'none' },
  instructionText: { fontSize: 14, color: '#666', marginBottom: 12, fontStyle: 'italic' },

  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wordChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0ddff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  wordChipSelected: { backgroundColor: '#2e64e5', borderColor: '#2e64e5' },
  wordChipText: { fontSize: 16, color: '#2e64e5', fontWeight: '600' },
  wordChipTextSelected: { color: '#ffffff' },

  matchingContainer: { flex: 1 },
  matchingColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  column: { flex: 1, gap: 10 },
  columnHeader: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5, textAlign: 'center' },
  matchCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0d8d0',
    borderRadius: 12,
    padding: 15,
    minHeight: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});