import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

const PACKS_STORAGE_KEY = '@ascend_downloaded_study_packs_v1';
const ACTIVE_PACK_KEY = '@ascend_active_study_pack_id_v1';

export interface FlashcardItem {
  term: string;
  definition: string;
}

export interface PracticeQuestionItem {
  question: string;
  options: string[];
  correct_answer: string;
}

export interface DownloadedStudyPack {
  id: string; // e.g. "Mathematics::Lesson 1"
  subjectTitle: string;
  moduleTitle: string;
  lessonData?: any;
  flashcards: FlashcardItem[]; // 10 cards
  practicePool: PracticeQuestionItem[]; // 20 questions stored locally
  downloadedAt: string;
}

export const makePackId = (subjectTitle: string, moduleTitle: string) =>
  `${subjectTitle.trim()}::${moduleTitle.trim()}`;

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...(arr || [])];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Draws 10 shuffled questions (with shuffled A/B/C/D options) from the 20-question pool
export function draw10FromPracticePool(pool: PracticeQuestionItem[]): PracticeQuestionItem[] {
  return shuffleArray(pool || [])
    .slice(0, 10)
    .map((q) => ({
      ...q,
      options: shuffleArray(q.options || []),
    }));
}

export async function getAllDownloadedPacks(): Promise<Record<string, DownloadedStudyPack>> {
  try {
    const raw = await AsyncStorage.getItem(PACKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read downloaded packs:', e);
    return {};
  }
}

export async function getActiveStudyPack(): Promise<DownloadedStudyPack | null> {
  const packs = await getAllDownloadedPacks();
  const activeId = await AsyncStorage.getItem(ACTIVE_PACK_KEY);
  if (activeId && packs[activeId]) {
    return packs[activeId];
  }
  const firstPack = Object.values(packs)[0];
  return firstPack || null;
}

export async function setActiveStudyPackId(packId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_PACK_KEY, packId);
}

export async function removeDownloadedPack(packId: string): Promise<void> {
  const packs = await getAllDownloadedPacks();
  delete packs[packId];
  await AsyncStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(packs));

  const currentActive = await AsyncStorage.getItem(ACTIVE_PACK_KEY);
  if (currentActive === packId) {
    const remainingIds = Object.keys(packs);
    if (remainingIds.length > 0) {
      await AsyncStorage.setItem(ACTIVE_PACK_KEY, remainingIds[0]);
    } else {
      await AsyncStorage.removeItem(ACTIVE_PACK_KEY);
    }
  }
}

// Downloads the 10 flashcards + 20 practice questions from Render and links them to the lesson
export async function downloadLessonStudyPack(params: {
  subjectTitle: string;
  moduleTitle: string;
  lessonData?: any;
}): Promise<DownloadedStudyPack> {
  const { subjectTitle, moduleTitle, lessonData } = params;

  const url = new URL('/api/study-pack', API_BASE_URL);
  url.searchParams.append('subjectTitle', subjectTitle || '');
  url.searchParams.append('moduleTitle', moduleTitle || '');

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'Failed to download study pack from server');
  }

  const data = await response.json();
  const packId = makePackId(subjectTitle, moduleTitle);

  const newPack: DownloadedStudyPack = {
    id: packId,
    subjectTitle,
    moduleTitle,
    lessonData: lessonData || null,
    flashcards: Array.isArray(data.flashcards) ? data.flashcards.slice(0, 10) : [],
    practicePool: Array.isArray(data.practice_pool) ? data.practice_pool.slice(0, 20) : [],
    downloadedAt: new Date().toISOString(),
  };

  const packs = await getAllDownloadedPacks();
  packs[packId] = newPack;

  await AsyncStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(packs));
  // Automatically make the newly downloaded lesson the active one for Flashcards & Practice
  await AsyncStorage.setItem(ACTIVE_PACK_KEY, packId);

  return newPack;
}