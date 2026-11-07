import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/ThemeContext';

export const PROGRESS_STORAGE_KEY = '@als_module_progress_v1';

// Helper: Split text into clean sentences without breaking decimals like 0.05
function splitSentences(text: string): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
  return matches ? matches.map((s) => s.trim()).filter((s) => s.length > 20) : [cleaned];
}

// Helper: Extract important keywords (5+ letters) from lesson text
function extractKeyTerms(text: string, excludeWord = ''): string[] {
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'against', 'all', 'also', 'always', 'among', 'another',
    'because', 'before', 'being', 'below', 'between', 'both', 'cannot', 'could', 'determine',
    'different', 'during', 'each', 'either', 'establish', 'established', 'every', 'example',
    'first', 'following', 'found', 'from', 'further', 'given', 'having', 'however', 'important',
    'include', 'including', 'instance', 'into', 'means', 'more', 'most', 'never', 'other',
    'others', 'otherwise', 'over', 'particular', 'people', 'process', 'provide', 'provides',
    'rather', 'really', 'refer', 'refers', 'regarding', 'related', 'represents', 'researchers',
    'result', 'results', 'same', 'second', 'section', 'several', 'should', 'shown', 'since',
    'small', 'smaller', 'some', 'something', 'specific', 'specifically', 'state', 'states',
    'still', 'study', 'such', 'system', 'systems', 'their', 'them', 'then', 'there', 'therefore',
    'these', 'they', 'thing', 'things', 'think', 'third', 'this', 'those', 'three', 'through',
    'together', 'under', 'understand', 'using', 'usually', 'value', 'values', 'various', 'where',
    'whether', 'which', 'while', 'within', 'without', 'would', 'lesson', 'module'
  ]);

  const words = (text || '')
    .replace(/[^a-zA-Z\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(
      (w) =>
        w.length >= 5 &&
        w.length <= 16 &&
        !stopWords.has(w.toLowerCase()) &&
        w.toLowerCase() !== excludeWord.toLowerCase()
    );

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const low = w.toLowerCase();
    if (!seen.has(low)) {
      seen.add(low);
      unique.push(w);
    }
  }
  return unique;
}

// Smart generator: Creates varied activity types based on lessonIndex and lesson content (No Truncation)
function buildVariedActivityFromLesson(lesson: any, lessonIdx: number) {
  const rawText = (
    lesson?.full_module_text ||
    lesson?.core_text ||
    lesson?.overview_body ||
    ''
  ).trim();

  const sentences = splitSentences(rawText);
  const terms = extractKeyTerms(rawText);
  const title = lesson?.lesson_title || 'this lesson';

  const typesCycle = [
    'multiple_choice',
    'drag_and_drop',
    'matching',
    'fill_in_blanks',
    'true_false',
  ];
  const chosenType = typesCycle[Math.abs(lessonIdx) % typesCycle.length];

  // 1. DRAG AND DROP
  if (chosenType === 'drag_and_drop' && sentences.length > 0 && terms.length >= 3) {
    const targetSentence =
      sentences.find((s) => s.length >= 45 && s.length <= 170 && terms.some((t) => s.includes(t))) ||
      sentences[0];
    const targetWord = terms.find((t) => targetSentence.includes(t)) || terms[0];

    if (targetSentence && targetWord && targetSentence.includes(targetWord)) {
      const blankedSentence = targetSentence.replace(targetWord, '____');
      const distractors = terms
        .filter((t) => t.toLowerCase() !== targetWord.toLowerCase())
        .slice(0, 3);
      while (distractors.length < 3) {
        distractors.push(['variance', 'parameter', 'constant', 'interval'][distractors.length]);
      }
      const options = [targetWord, ...distractors].sort((a, b) => a.localeCompare(b));

      return {
        activity_type: 'drag_and_drop',
        question_prompt: blankedSentence,
        options,
        correct_answer: targetWord,
      };
    }
  }

  // 2. MATCHING (Full sentences, no cutting off with '...')
  if (chosenType === 'matching' && (Array.isArray(lesson?.key_concepts) || sentences.length >= 3)) {
    const pairs: { term: string; definition: string }[] = [];

    if (Array.isArray(lesson?.key_concepts) && lesson.key_concepts.length >= 3) {
      lesson.key_concepts.slice(0, 3).forEach((kc: any, i: number) => {
        const firstSent = splitSentences(kc.concept_body)[0] || kc.concept_body;
        pairs.push({
          term: kc.concept_title || `Concept ${i + 1}`,
          definition: firstSent, // Full text, no truncation
        });
      });
    } else {
      const usableSentences = sentences.slice(0, 3);
      usableSentences.forEach((sent, idx) => {
        const sentTerms = extractKeyTerms(sent);
        const keyTerm = sentTerms[0] ? sentTerms[0].charAt(0).toUpperCase() + sentTerms[0].slice(1) : `Point ${idx + 1}`;
        pairs.push({ term: keyTerm, definition: sent }); // Full text, no truncation
      });
    }

    if (pairs.length >= 2) {
      return {
        activity_type: 'matching',
        question_prompt: `Match each key term from "${title}" with its corresponding statement:`,
        matching_pairs: pairs,
      };
    }
  }

  // 3. FILL IN THE BLANKS
  if (chosenType === 'fill_in_blanks' && sentences.length > 0 && terms.length >= 1) {
    const targetSentence =
      sentences.find((s) => s.length >= 40 && s.length <= 160 && terms.some((t) => s.includes(t))) ||
      sentences[0];
    const targetWord = terms.find((t) => targetSentence.includes(t)) || terms[0];

    if (targetSentence && targetWord && targetSentence.includes(targetWord)) {
      const blanked = targetSentence.replace(targetWord, '_______');
      return {
        activity_type: 'fill_in_blanks',
        question_prompt: `Fill in the missing term (Hint: starts with "${targetWord.slice(0, 2)}", ${targetWord.length} letters):\n\n"${blanked}"`,
        correct_answer: targetWord,
      };
    }
  }

  // 4. TRUE OR FALSE
  if (chosenType === 'true_false' && sentences.length > 0) {
    const factSentence = sentences[Math.min(1, sentences.length - 1)] || sentences[0];
    return {
      activity_type: 'true_false',
      question_prompt: `True or False: Based on "${title}", ${factSentence.charAt(0).toLowerCase() + factSentence.slice(1)}`,
      options: ['True', 'False'],
      correct_answer: 'True',
    };
  }

  // 5. MULTIPLE CHOICE (Full sentence, no truncating with '...')
  if (sentences.length > 0) {
    const correctSent = sentences[Math.min(1, sentences.length - 1)] || sentences[0];
    const keyTopic = terms[0] || title;

    const options = [
      correctSent, // Full sentence
      `It completely eliminates the need to evaluate ${keyTopic.toLowerCase()} in any scenario.`,
      `It states that ${keyTopic.toLowerCase()} remains fixed regardless of the data or context.`,
      `It only applies when no measurements or observations are recorded.`,
    ];

    return {
      activity_type: 'multiple_choice',
      question_prompt:
        lesson?.knowledge_check_question ||
        `Which of the following statements accurately describes a core concept from "${title}"?`,
      options,
      correct_answer: correctSent,
    };
  }

  return {
    activity_type: 'true_false',
    question_prompt: `Did you finish reviewing "${title}" and understand its main concepts?`,
    options: ['True', 'False'],
    correct_answer: 'True',
  };
}

export default function ActivityScreen() {
  const { theme } = useAppTheme();
  const { lessonData, subject, moduleId, lessonIndex, totalLessons } = useLocalSearchParams();
  const [lesson, setLesson] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [subjectName, setSubjectName] = useState<string>((subject as string) || '');
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const lessonIdxNum = parseInt((lessonIndex as string) || '0', 10);

  useEffect(() => {
    if (lessonData) {
      try {
        const parsed = JSON.parse(lessonData as string);
        setLesson(parsed);

        if (parsed.activity && parsed.activity.question_prompt && parsed.activity.activity_type) {
          setActivity(parsed.activity);
        } else {
          setActivity(buildVariedActivityFromLesson(parsed, lessonIdxNum));
        }
      } catch (e) {
        console.error('Failed to parse lesson data', e);
      }
    }
  }, [lessonData, lessonIdxNum]);

  const isAnswerCorrect = (userAns: string, act: any): boolean => {
    if (!act) return false;
    const rawCorrect = act.correct_answer ?? act.answer ?? act.correctAnswer ?? act.correct;
    if (rawCorrect === undefined || rawCorrect === null) return false;

    const superClean = (str: string) =>
      String(str || '')
        .replace(/^(option\s+[a-d]|option\s+\d|[a-d][.)\-:]|\d+[.)\-:])\s*/i, '')
        .trim()
        .toLowerCase();

    const cleanUser = superClean(userAns);
    const cleanCorrect = superClean(rawCorrect);

    if (
      cleanUser &&
      cleanCorrect &&
      (cleanUser === cleanCorrect ||
        cleanUser.includes(cleanCorrect) ||
        cleanCorrect.includes(cleanUser))
    ) {
      return true;
    }

    if (Array.isArray(act.options)) {
      const letters = ['a', 'b', 'c', 'd', 'e'];
      const userIdx = act.options.findIndex((opt: string) => superClean(opt) === cleanUser);

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
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 12 }]}>Loading Activity...</Text>
      </SafeAreaView>
    );
  }

  const recordLessonCompletion = async () => {
    setIsSavingProgress(true);
    const completedCount = lessonIdxNum + 1;
    const totalCount = Math.max(1, parseInt((totalLessons as string) || '5', 10));
    const targetProgress = Math.min(100, Math.round((completedCount / totalCount) * 100));

    try {
      const raw = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      const key = String(moduleId || subject || subjectName || 'default');
      map[key] = Math.max(map[key] || 0, completedCount);
      await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Local progress save error:', e);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (moduleId) {
        const { data: modRow } = await supabase
          .from('ai_lessons')
          .select('id, progress, title')
          .eq('id', moduleId)
          .maybeSingle();

        if (modRow) {
          if (modRow.title) setSubjectName(modRow.title);
          const newProgress = Math.max(modRow.progress || 0, targetProgress);
          await supabase.from('ai_lessons').update({ progress: newProgress }).eq('id', modRow.id);
        }
      } else {
        const { data: allModules } = await supabase
          .from('ai_lessons')
          .select('id, progress, parsed_content, title');

        const currentTitle = lesson?.lesson_title || lesson?.title;
        const parentMod = allModules?.find((m: any) =>
          m.parsed_content?.lessons?.some((l: any) => (l.lesson_title || l.title) === currentTitle)
        );

        if (parentMod) {
          if (parentMod.title) setSubjectName(parentMod.title);
          const newProgress = Math.max(parentMod.progress || 0, targetProgress);
          await supabase.from('ai_lessons').update({ progress: newProgress }).eq('id', parentMod.id);
        }
      }

      if (user) {
        try {
          const { data: profile } = await supabase.from('students').select('xp').eq('id', user.id).single();
          const newXp = (profile?.xp || 0) + 50;
          await supabase.from('students').update({ xp: newXp }).eq('id', user.id);
          await supabase.rpc('log_daily_xp', { p_student_id: user.id, p_xp: 50 });
        } catch (err) {
          console.error('XP Update Failed:', err);
        }
      }
    } catch (err) {
      console.error('Supabase Progress Update Failed:', err);
    } finally {
      setIsSavingProgress(false);
    }
  };

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

    setIsCorrect(correct);
    setIsSubmitted(true);

    if (correct) {
      await recordLessonCompletion();
    }
  };

  const handleContinue = () => {
    const targetSubject = (subject as string) || subjectName || 'Course Modules';
    const unlockedLessonsCount = String(lessonIdxNum + 1);

    try {
      router.replace({
        pathname: '/lesson',
        params: {
          subject: targetSubject,
          moduleId: (moduleId as string) || '',
          unlockedCount: unlockedLessonsCount,
          refreshTs: String(Date.now()),
        },
      } as any);
    } catch (error) {
      console.error('Routing error:', error);
      router.back();
    }
  };

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
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              isSelected && [styles.optionCardSelected, theme.isDark && { backgroundColor: '#1e3a8a' }],
              isSubmitted && isThisOptionCorrect && styles.optionCardCorrect,
              isSubmitted && isSelected && !isThisOptionCorrect && styles.optionCardWrong,
            ]}
            onPress={() => !isSubmitted && setUserAnswer(option)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionText,
                { color: theme.textPrimary },
                isSelected && [styles.optionTextSelected, theme.isDark && { color: '#60a5fa' }],
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
              { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
              isSelected && [styles.optionCardSelected, theme.isDark && { backgroundColor: '#1e3a8a' }],
              isSubmitted && isThisOptionCorrect && styles.optionCardCorrect,
              isSubmitted && isSelected && !isThisOptionCorrect && styles.optionCardWrong,
            ]}
            onPress={() => !isSubmitted && setUserAnswer(option)}
          >
            <Text
              style={[
                styles.optionText,
                { color: theme.textPrimary },
                isSelected && [styles.optionTextSelected, theme.isDark && { color: '#60a5fa' }],
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
          { backgroundColor: theme.cardBg, borderColor: theme.borderColor, color: theme.textPrimary },
          isSubmitted && isCorrect && styles.inputCorrect,
          isSubmitted && !isCorrect && styles.inputWrong,
        ]}
        placeholder="Type your answer here..."
        placeholderTextColor={theme.textSecondary}
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
        <View style={[styles.sentenceContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.sentenceText, { color: theme.textPrimary }]}>
            {sentenceParts[0]}
            <Text style={[styles.blankSpace, userAnswer ? styles.filledBlank : null]}>
              {userAnswer ? ` ${userAnswer} ` : ' _______ '}
            </Text>
            {sentenceParts[1]}
          </Text>
        </View>

        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>Tap a word below to fill the blank:</Text>

        <View style={styles.wordBank}>
          {activity.options?.map((word: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.wordChip,
                { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                userAnswer === word && styles.wordChipSelected,
              ]}
              onPress={() => !isSubmitted && setUserAnswer(word)}
            >
              <Text
                style={[
                  styles.wordChipText,
                  theme.isDark && { color: '#60a5fa' },
                  userAnswer === word && styles.wordChipTextSelected,
                ]}
              >
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
      <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
        Step 1: Tap a Term. Step 2: Tap its Definition.
      </Text>

      <View style={styles.matchingColumns}>
        <View style={styles.column}>
          <Text style={[styles.columnHeader, { color: theme.textPrimary }]}>Terms</Text>
          {activity.matching_pairs?.map((pair: any, index: number) => {
            const isMatched = !!matchedPairs[pair.term];
            const isSelected = selectedTerm === pair.term;

            return (
              <TouchableOpacity
                key={`term-${index}`}
                style={[
                  styles.matchCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  isSelected && [styles.matchCardSelected, theme.isDark && { backgroundColor: '#1e3a8a' }],
                  isMatched && styles.matchCardMatched,
                ]}
                onPress={() => !isSubmitted && !isMatched && setSelectedTerm(pair.term)}
              >
                <Text
                  style={[
                    styles.matchText,
                    { color: theme.textPrimary },
                    (isSelected || isMatched) && styles.matchTextSelected,
                  ]}
                >
                  {pair.term}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.column}>
          <Text style={[styles.columnHeader, { color: theme.textPrimary }]}>Definitions</Text>
          {activity.matching_pairs?.map((pair: any, index: number) => {
            const matchedTerm = Object.keys(matchedPairs).find(
              (term) => matchedPairs[term] === pair.definition
            );

            return (
              <TouchableOpacity
                key={`def-${index}`}
                style={[
                  styles.matchCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
                  matchedTerm && styles.matchCardMatched,
                ]}
                onPress={() => {
                  if (!isSubmitted && selectedTerm && !matchedTerm) {
                    setMatchedPairs((prev) => ({ ...prev, [selectedTerm]: pair.definition }));
                    setSelectedTerm(null);
                  }
                }}
              >
                <Text
                  style={[
                    styles.matchText,
                    { color: theme.textPrimary },
                    matchedTerm && styles.matchTextSelected,
                  ]}
                >
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Knowledge Check</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.badgeContainer, theme.isDark && { backgroundColor: '#1e3a8a' }]}>
          <Text style={[styles.badgeText, theme.isDark && { color: '#60a5fa' }]}>
            {activity.activity_type ? activity.activity_type.replace(/_/g, ' ').toUpperCase() : 'ACTIVITY'}
          </Text>
        </View>

        <Text style={[styles.promptText, { color: theme.textPrimary }]}>
          {activity.activity_type === 'drag_and_drop'
            ? 'Complete the sentence:'
            : activity.question_prompt}
        </Text>

        <View style={styles.gameBoard}>
          {activity.activity_type === 'multiple_choice' && renderMultipleChoice()}
          {activity.activity_type === 'true_false' && renderTrueFalse()}
          {activity.activity_type === 'fill_in_blanks' && renderFillInBlanks()}
          {activity.activity_type === 'drag_and_drop' && renderDragAndDrop()}
          {activity.activity_type === 'matching' && renderMatching()}
        </View>

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

      <View style={[styles.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderColor }]}>
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
            disabled={isSavingProgress}
            onPress={() => (isCorrect ? handleContinue() : setIsSubmitted(false))}
          >
            {isSavingProgress ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{isCorrect ? 'Continue Learning' : 'Try Again'}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  badgeContainer: { backgroundColor: '#e0e8f9', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16 },
  badgeText: { color: '#2e64e5', fontSize: 12, fontWeight: 'bold' },
  promptText: { fontSize: 20, fontWeight: 'bold', marginBottom: 24, lineHeight: 28 },
  gameBoard: { marginBottom: 24 },
  optionsContainer: { gap: 12 },
  optionCard: { borderWidth: 2, borderRadius: 16, padding: 18 },
  optionCardSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  optionCardCorrect: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  optionCardWrong: { borderColor: '#f44336', backgroundColor: '#ffebee' },
  optionText: { fontSize: 15, fontWeight: '500', lineHeight: 22 }, // Allows natural wrapping
  optionTextSelected: { color: '#2e64e5', fontWeight: 'bold' },
  optionTextCorrect: { color: '#155724', fontWeight: 'bold' },
  inputContainer: { width: '100%' },
  textInput: { borderWidth: 2, borderRadius: 16, padding: 20, fontSize: 18 },
  inputCorrect: { borderColor: '#4caf50', backgroundColor: '#e8f5e9', color: '#155724' },
  inputWrong: { borderColor: '#f44336', backgroundColor: '#ffebee', color: '#721c24' },
  sentenceContainer: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  sentenceText: { fontSize: 18, lineHeight: 28 },
  blankSpace: { color: '#999', textDecorationLine: 'underline' },
  filledBlank: { color: '#2e64e5', fontWeight: 'bold', textDecorationLine: 'none' },
  instructionText: { fontSize: 14, marginBottom: 12, fontStyle: 'italic' },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wordChip: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  wordChipSelected: { backgroundColor: '#2e64e5', borderColor: '#2e64e5' },
  wordChipText: { fontSize: 16, color: '#2e64e5', fontWeight: '600' },
  wordChipTextSelected: { color: '#ffffff' },
  matchingContainer: { flex: 1 },
  matchingColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  column: { flex: 1, gap: 10 },
  columnHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  matchCard: { borderWidth: 2, borderRadius: 12, padding: 15, minHeight: 70, justifyContent: 'center', alignItems: 'center' },
  matchCardSelected: { borderColor: '#2e64e5', backgroundColor: '#f0f4ff' },
  matchCardMatched: { borderColor: '#4caf50', backgroundColor: '#e8f5e9', opacity: 0.8 },
  matchText: { fontSize: 13, textAlign: 'center', fontWeight: '500', lineHeight: 18 },
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
  footer: { padding: 20, borderTopWidth: 1 },
  submitButton: { backgroundColor: '#2e64e5', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#a0b9c1' },
  continueButton: { backgroundColor: '#4caf50' },
  retryButton: { backgroundColor: '#f44336' },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});