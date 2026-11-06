import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../lib/config';
import { getActiveStudyPack } from '../lib/offlineStudyPacks';
import { useAppTheme } from '../lib/ThemeContext';

const { width } = Dimensions.get('window');

export default function FlashcardsScreen() {
  const { theme } = useAppTheme();
  const { subject, module } = useLocalSearchParams<{ subject: string, module: string }>();

  const [flashcardData, setFlashcardData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const flipAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        setIsLoading(true);
        const activePack = await getActiveStudyPack();
        if (activePack && activePack.flashcards && activePack.flashcards.length > 0) {
          const matchesRequested = (!subject || subject === activePack.subjectTitle) && (!module || module === activePack.moduleTitle);
          if (matchesRequested || (!subject && !module)) {
            setFlashcardData(activePack.flashcards);
            setIsLoading(false);
            return;
          }
        }

        const apiUrl = new URL('/api/generate-flashcards', API_BASE_URL);
        apiUrl.searchParams.append('subjectTitle', subject || '');
        apiUrl.searchParams.append('moduleTitle', module || '');

        const response = await fetch(apiUrl.toString());
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
          const textError = await response.text();
          console.error("Backend did not return JSON:", textError);
          setFlashcardData([]);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        if (data.error) {
          console.warn("Module not ready:", data.error);
          setFlashcardData([]);
        } else {
          setFlashcardData(data);
        }
      } catch (error) {
        console.error("Failed to load flashcards", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlashcards();
  }, [subject, module]);

  const flipCard = () => {
    Animated.spring(flipAnimation, {
      toValue: isFlipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const nextCard = () => {
    if (currentIndex < flashcardData.length - 1) {
      flipAnimation.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      flipAnimation.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color="#2e64e5" />
        <Text style={{ marginTop: 15, fontSize: 16, color: theme.textPrimary, fontWeight: 'bold' }}>Gemini is reading the module...</Text>
      </View>
    );
  }

  if (!Array.isArray(flashcardData) || flashcardData.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, padding: 30 }}>
        <Ionicons name="alert-circle-outline" size={60} color="#f44336" />
        <Text style={{ marginTop: 15, fontSize: 16, color: theme.textSecondary, fontWeight: 'bold', textAlign: 'center' }}>
          No flashcards could be generated. Please ensure this specific module has been uploaded!
        </Text>
        <TouchableOpacity style={{ marginTop: 30, backgroundColor: '#2e64e5', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12 }} onPress={() => router.back()}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const frontAnimatedStyle = {
    transform: [{ rotateY: flipAnimation.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) }],
    backfaceVisibility: 'hidden' as 'hidden',
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: flipAnimation.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] }) }],
    backfaceVisibility: 'hidden' as 'hidden',
    position: 'absolute' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  const card = flashcardData[currentIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Flashcards</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
            {module || subject || 'Review'}
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>Card {currentIndex + 1} of {flashcardData.length}</Text>
        <View style={[styles.progressBarBg, theme.isDark && { backgroundColor: '#334155' }]}>
          <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / flashcardData.length) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity activeOpacity={0.9} onPress={flipCard} style={styles.cardTouchArea}>

          <Animated.View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }, frontAnimatedStyle]}>
            <View style={styles.cardInner}>
              <Ionicons name="bulb-outline" size={32} color="#2e64e5" style={styles.cardIcon} />
              <Text style={[styles.termText, { color: theme.textPrimary }]}>{card.term}</Text>
              <Text style={[styles.tapPrompt, { color: theme.textSecondary }]}>Tap to reveal definition</Text>
            </View>
          </Animated.View>

          <Animated.View style={[
            styles.card,
            styles.cardBack,
            { backgroundColor: theme.isDark ? '#1e3a8a' : '#f0f4ff', borderColor: theme.isDark ? '#3b82f6' : '#d0ddff' },
            backAnimatedStyle
          ]}>
            <View style={styles.cardInner}>
              <Text style={[styles.definitionText, { color: theme.textPrimary }]}>{card.definition}</Text>
            </View>
          </Animated.View>

        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            currentIndex === 0 && [styles.controlButtonDisabled, theme.isDark && { backgroundColor: '#1e293b', borderColor: '#334155', opacity: 0.4 }]
          ]}
          onPress={prevCard}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={32} color={currentIndex === 0 ? theme.textSecondary : "#2e64e5"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
            currentIndex === flashcardData.length - 1 && [styles.controlButtonDisabled, theme.isDark && { backgroundColor: '#1e293b', borderColor: '#334155', opacity: 0.4 }]
          ]}
          onPress={nextCard}
          disabled={currentIndex === flashcardData.length - 1}
        >
          <Ionicons name="chevron-forward" size={32} color={currentIndex === flashcardData.length - 1 ? theme.textSecondary : "#2e64e5"} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, minHeight: 70, position: 'relative' },
  backButton: { position: 'absolute', left: 15, zIndex: 10, padding: 10 },
  headerCenter: { alignItems: 'center', paddingHorizontal: 65 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  headerSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 2, lineHeight: 18 },
  progressContainer: { paddingHorizontal: 30, marginBottom: 30 },
  progressText: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  progressBarBg: { height: 8, backgroundColor: '#e0e8f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2e64e5', borderRadius: 4 },
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardTouchArea: { width: width * 0.85, height: width * 1.1 },
  card: { flex: 1, borderRadius: 24, borderWidth: 1, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12 },
  cardBack: {},
  cardInner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  cardIcon: { marginBottom: 20 },
  termText: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', lineHeight: 36 },
  definitionText: { fontSize: 20, textAlign: 'center', lineHeight: 30, fontWeight: '500' },
  tapPrompt: { position: 'absolute', bottom: 30, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 40, gap: 40 },
  controlButton: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 2, shadowColor: '#2e64e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
  controlButtonDisabled: { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0', elevation: 0, shadowOpacity: 0 },
});