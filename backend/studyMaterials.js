// studyMaterials.js (put it next to server.js)
//
// Automatically generates and stores:
//   - 10 study flashcards per lesson/subject
//   - 20 practice quiz questions per lesson/subject (serves 10 shuffled at a time, or all 20 for offline download)

import { Type } from '@google/genai';
import {
  GEMINI_MODEL,
  fallbackModel,
  questionsSchema,
  normTitle,
  lessonName,
  cleanParam,
  sleep,
  errorText,
  isRetryable,
  shuffle,
  cleanQuestions,
} from './assessmentRoutes.js';

export const FLASHCARD_COUNT = 10;
export const PRACTICE_POOL_COUNT = 20; // Total generated & downloaded for offline use
export const PRACTICE_SERVE_COUNT = 10; // Number of questions shown per practice attempt

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS) || 2000;
const BACKFILL_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours
const STEP_DELAY_MS = 4000; // Polite gap between background Gemini calls

export const flashcardsSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      term: { type: Type.STRING },
      definition: { type: Type.STRING },
    },
    required: ['term', 'definition'],
  },
};

export function cleanFlashcards(raw, limit = FLASHCARD_COUNT) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.term === 'string' && typeof c.definition === 'string')
    .map((c) => ({ term: c.term.trim(), definition: c.definition.trim() }))
    .filter((c) => c.term && c.definition)
    .slice(0, limit);
}

export function pickPracticeSubset(pool, count = PRACTICE_SERVE_COUNT) {
  return shuffle(pool || [])
    .slice(0, count)
    .map((q) => ({ ...q, options: shuffle(q.options || []) }));
}

export function registerStudyMaterials(app, { supabase, admin, ai }) {
  const db = admin || supabase;
  const memoryStore = new Map(); // key -> { flashcards, practice_questions }
  const pendingSubjects = new Set();
  let workerRunning = false;

  const makeKey = (subjectTitle, moduleTitle = '') =>
    `${normTitle(subjectTitle)}|${normTitle(moduleTitle)}`;

  async function callGeminiWithRetry({ contents, schema, temperature = 0.7 }) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const model = attempt > 1 && fallbackModel() ? fallbackModel() : GEMINI_MODEL;
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            temperature,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });
        if (!response.text) throw new Error('Gemini returned an empty response');
        return JSON.parse(response.text);
      } catch (error) {
        lastError = error;
        console.error(`Gemini studyMaterial attempt ${attempt}/${MAX_ATTEMPTS} failed:`, errorText(error));
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        await sleep(RETRY_BASE_MS * attempt);
      }
    }
    throw lastError;
  }

  async function generateFlashcardsFromText(content) {
    const prompt = `
      Based ONLY on the following educational content for Alternative Learning System (ALS) students,
      generate exactly ${FLASHCARD_COUNT} highly effective study flashcards.
      Content:
      ${content}

      Output ONLY a JSON array of ${FLASHCARD_COUNT} objects with "term" and "definition".
    `;
    const raw = await callGeminiWithRetry({
      contents: prompt,
      schema: flashcardsSchema,
      temperature: 0.5,
    });
    const cards = cleanFlashcards(raw, FLASHCARD_COUNT);
    if (cards.length === 0) throw new Error('Gemini returned too few valid flashcards');
    return cards;
  }

  async function generatePracticePoolFromText(content) {
    const prompt = `
      You are writing an ungraded practice question bank for Alternative Learning System (ALS) students.
      Using ONLY the educational content below, write ${PRACTICE_POOL_COUNT} multiple-choice questions.

      Rules:
      - Each question has exactly 4 options and exactly ONE correct answer.
      - "correct_answer" must match one of the strings in "options" EXACTLY.
      - Cover different parts of the lesson so students get variety when 10 questions are drawn at random.
      - Questions must stand on their own without saying "according to the text".
      - No "all of the above" or "none of the above".
      - Use clear, encouraging, everyday language.

      Content:
      ${content}

      Output ONLY a JSON array of ${PRACTICE_POOL_COUNT} objects:
      [{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "B"}]
    `;
    const raw = await callGeminiWithRetry({
      contents: prompt,
      schema: questionsSchema,
      temperature: 0.9,
    });
    const questions = cleanQuestions(raw, PRACTICE_POOL_COUNT);
    if (questions.length < 5) throw new Error('Gemini returned too few valid practice questions');
    return questions;
  }

  // Read pre-generated materials from memory, study_materials table, or ai_lessons JSON
  async function getStoredMaterials(subjectTitle, moduleTitle = '') {
    const sKey = normTitle(subjectTitle);
    const mKey = normTitle(moduleTitle === subjectTitle ? '' : moduleTitle);
    const cacheKey = makeKey(sKey, mKey);

    const mem = memoryStore.get(cacheKey);
    if (mem && mem.flashcards?.length >= 5 && mem.practice_questions?.length >= 10) {
      return mem;
    }

    // 1. Check dedicated study_materials table
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select('flashcards, practice_questions')
        .eq('subject_key', sKey)
        .eq('module_key', mKey)
        .maybeSingle();

      if (!error && data) {
        const flashcards = cleanFlashcards(data.flashcards, FLASHCARD_COUNT);
        const practice_questions = cleanQuestions(data.practice_questions, PRACTICE_POOL_COUNT);
        if (flashcards.length > 0 || practice_questions.length > 0) {
          const entry = { flashcards, practice_questions };
          memoryStore.set(cacheKey, entry);
          return entry;
        }
      }
    } catch (_) {
      // Table may not exist yet; fall through to ai_lessons check
    }

    // 2. Fallback: Check inside ai_lessons.parsed_content
    try {
      const { data: rows } = await supabase
        .from('ai_lessons')
        .select('parsed_content')
        .ilike('title', subjectTitle);

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const pc = row.parsed_content || {};
          if (!mKey && (pc.flashcards?.length || pc.practice_pool?.length)) {
            const entry = {
              flashcards: cleanFlashcards(pc.flashcards, FLASHCARD_COUNT),
              practice_questions: cleanQuestions(pc.practice_pool, PRACTICE_POOL_COUNT),
            };
            memoryStore.set(cacheKey, entry);
            return entry;
          }
          if (Array.isArray(pc.lessons)) {
            for (const lesson of pc.lessons) {
              if (normTitle(lessonName(lesson)) === mKey) {
                if (lesson.flashcards?.length || lesson.practice_pool?.length) {
                  const entry = {
                    flashcards: cleanFlashcards(lesson.flashcards, FLASHCARD_COUNT),
                    practice_questions: cleanQuestions(lesson.practice_pool, PRACTICE_POOL_COUNT),
                  };
                  memoryStore.set(cacheKey, entry);
                  return entry;
                }
              }
            }
          }
        }
      }
    } catch (_) {}

    return null;
  }

  async function saveMaterials(subjectTitle, moduleTitle, flashcards, practice_questions) {
    const sKey = normTitle(subjectTitle);
    const mKey = normTitle(moduleTitle === subjectTitle ? '' : moduleTitle);
    const cacheKey = makeKey(sKey, mKey);

    const entry = { flashcards, practice_questions };
    memoryStore.set(cacheKey, entry);

    // Save to study_materials table if present
    try {
      await db.from('study_materials').upsert(
        {
          subject_key: sKey,
          module_key: mKey,
          subject_title: subjectTitle,
          module_title: mKey ? moduleTitle : '',
          flashcards,
          practice_questions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'subject_key,module_key' }
      );
    } catch (e) {
      console.warn('study_materials table upsert skipped:', e.message);
    }
  }

  // Ensures a specific (subjectTitle, moduleTitle) has 10 flashcards and 20 practice questions
  async function ensureMaterials(subjectTitle, moduleTitle, contentText) {
    const existing = await getStoredMaterials(subjectTitle, moduleTitle);
    let flashcards = existing?.flashcards || [];
    let practice_questions = existing?.practice_questions || [];

    let changed = false;
    if (flashcards.length < 5) {
      flashcards = await generateFlashcardsFromText(contentText);
      changed = true;
    }
    if (practice_questions.length < 10) {
      practice_questions = await generatePracticePoolFromText(contentText);
      changed = true;
    }

    if (changed) {
      await saveMaterials(subjectTitle, moduleTitle, flashcards, practice_questions);
    }
    return { flashcards, practice_questions };
  }

  // Scans all rows for a subject and pre-generates materials for each lesson + whole subject
  async function processSubjectRows(subjectTitle, rows) {
    let allContent = '';
    let rowsUpdated = false;

    for (const row of rows) {
      const pc = row.parsed_content;
      if (!pc || !Array.isArray(pc.lessons)) continue;
      let rowChanged = false;

      for (const lesson of pc.lessons) {
        const mTitle = lessonName(lesson);
        const text = `LESSON: ${mTitle}\n${lesson.core_text ?? JSON.stringify(lesson)}`;
        allContent += text + '\n\n';

        const hasCards = Array.isArray(lesson.flashcards) && lesson.flashcards.length >= 5;
        const hasPool = Array.isArray(lesson.practice_pool) && lesson.practice_pool.length >= 10;

        if (!hasCards || !hasPool) {
          try {
            console.log(`⚙️ Auto-generating study pack for [${subjectTitle} -> ${mTitle}]...`);
            const mat = await ensureMaterials(subjectTitle, mTitle, text.slice(0, 60000));
            lesson.flashcards = mat.flashcards;
            lesson.practice_pool = mat.practice_questions;
            rowChanged = true;
            await sleep(STEP_DELAY_MS);
          } catch (e) {
            console.error(`⚠️ Failed auto-generation for [${mTitle}]:`, e.message);
          }
        } else {
          // Mirror existing embedded data into study_materials lookup
          await saveMaterials(subjectTitle, mTitle, lesson.flashcards, lesson.practice_pool);
        }
      }

      if (rowChanged && row.id) {
        await db.from('ai_lessons').update({ parsed_content: pc }).eq('id', row.id);
        rowsUpdated = true;
      }
    }

    // Also pre-generate a subject-wide pack
    if (allContent.trim()) {
      try {
        await ensureMaterials(subjectTitle, '', allContent.slice(0, 60000));
      } catch (e) {
        console.error(`⚠️ Failed subject-wide pack for [${subjectTitle}]:`, e.message);
      }
    }
    if (rowsUpdated) {
      console.log(`✅ Completed background study materials for subject: ${subjectTitle}`);
    }
  }

  async function drainQueue() {
    if (workerRunning) return;
    workerRunning = true;
    try {
      while (pendingSubjects.size > 0) {
        const subjectTitle = pendingSubjects.values().next().value;
        pendingSubjects.delete(subjectTitle);

        const { data: rows, error } = await supabase
          .from('ai_lessons')
          .select('id, title, parsed_content')
          .eq('title', subjectTitle);

        if (!error && rows && rows.length > 0) {
          await processSubjectRows(subjectTitle, rows);
        }
      }
    } catch (e) {
      console.error('Background study material worker error:', e.message);
    } finally {
      workerRunning = false;
    }
  }

  async function queueSubject(subjectTitle) {
    const clean = cleanParam(subjectTitle);
    if (!clean) return;
    pendingSubjects.add(clean);
    setImmediate(() => drainQueue());
  }

  function startBackfill() {
    const runPass = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('ai_lessons')
          .select('title');
        if (error || !rows) return;
        const uniqueSubjects = [...new Set(rows.map((r) => cleanParam(r.title)).filter(Boolean))];
        uniqueSubjects.forEach((s) => pendingSubjects.add(s));
        await drainQueue();
      } catch (e) {
        console.error('Backfill check failed:', e.message);
      }
    };

    // Start 5 seconds after server boot, then repeat every 6 hours
    setTimeout(runPass, 5000);
    setInterval(runPass, BACKFILL_INTERVAL_MS);
  }

  // --- 🟢 OFFLINE DOWNLOAD ENDPOINT ---
  // Returns the 10 flashcards + full 20-item practice pool + 10-item active quiz in one JSON payload
  app.get('/api/study-pack', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const subjectTitle = cleanParam(req.query.subjectTitle);
      const moduleTitle = cleanParam(req.query.moduleTitle);
      if (!subjectTitle) return res.status(400).json({ error: 'subjectTitle is required.' });

      const stored = await getStoredMaterials(subjectTitle, moduleTitle);
      if (stored && stored.flashcards.length > 0 && stored.practice_questions.length > 0) {
        return res.json({
          subjectTitle,
          moduleTitle,
          flashcards: stored.flashcards, // 10 flashcards
          practice_pool: stored.practice_questions, // All 20 practice questions for offline shuffling
          practice_quiz: pickPracticeSubset(stored.practice_questions, PRACTICE_SERVE_COUNT), // 10 shuffled
        });
      }

      // If not pre-generated yet, build it now and save it
      const { data, error } = await supabase
        .from('ai_lessons')
        .select('parsed_content')
        .eq('title', subjectTitle);

      if (error || !data || data.length === 0) {
        return res.status(404).json({ error: 'Subject not found in database.' });
      }

      const wantAll = !moduleTitle || normTitle(moduleTitle) === normTitle(subjectTitle);
      let content = '';
      data.forEach((row) => {
        const lessons = row.parsed_content?.lessons;
        if (!Array.isArray(lessons)) return;
        lessons.forEach((lesson) => {
          const name = lessonName(lesson);
          if (wantAll || normTitle(name) === normTitle(moduleTitle)) {
            content += `LESSON: ${name}\n${lesson.core_text ?? JSON.stringify(lesson)}\n\n`;
          }
        });
      });

      if (!content.trim()) {
        return res.status(404).json({ error: 'Specific module content not found.' });
      }

      const built = await ensureMaterials(subjectTitle, moduleTitle, content.slice(0, 60000));
      res.json({
        subjectTitle,
        moduleTitle,
        flashcards: built.flashcards,
        practice_pool: built.practice_questions,
        practice_quiz: pickPracticeSubset(built.practice_questions, PRACTICE_SERVE_COUNT),
      });
    } catch (error) {
      console.error('Study pack error:', error);
      res.status(500).json({ error: 'Could not prepare downloadable study pack.' });
    }
  });

  return {
    queueSubject,
    startBackfill,
    getStoredMaterials,
    ensureMaterials,
    pickPracticeSubset,
  };
}