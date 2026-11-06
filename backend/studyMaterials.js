// studyMaterials.js (put it next to server.js)
//
// Prepares flashcards (10) and a practice-question pool (20) for every lesson
// IN THE BACKGROUND, stores them in the Supabase table `study_materials`, and
// serves them instantly to the app.
//
// Routes supported:
//   GET /api/study-materials?subjectTitle=<subject>&moduleTitle=<lesson>
//   GET /api/study-materials?subjectTitle=<subject>          (whole subject, merged)
//   GET /api/study-pack?subjectTitle=<subject>&moduleTitle=<lesson>

import { createHash } from 'crypto';
import { Type } from '@google/genai';
import {
  GEMINI_MODEL,
  fallbackModel,
  questionsSchema,
  cleanQuestions,
  cleanParam,
  normTitle,
  lessonName,
  sleep,
  errorText,
  isRateLimited,
  isRetryable,
  shuffle,
} from './assessmentRoutes.js';

const GENERATOR_VERSION = 'v1';        // bump to regenerate everything (e.g. new counts)
export const FLASHCARD_COUNT = 10;
export const PRACTICE_POOL_COUNT = 20; // Total generated & downloaded for offline use
export const PRACTICE_SERVE_COUNT = 10; // Number of questions shown per practice attempt

const MIN_FLASHCARDS = 5;              // accept a bit less rather than fail
const MIN_PRACTICE = 10;
const MAX_LESSON_CHARS = 30000;
const SUBJECT_POOL_CAP = 60;           // whole-subject practice draws from all lessons
const MAX_ON_DEMAND_LESSONS = 3;       // lessons generated while a student waits

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS) || 2000;
const GAP_BETWEEN_JOBS_MS =
  process.env.STUDY_JOB_GAP_MS !== undefined ? Number(process.env.STUDY_JOB_GAP_MS) : 3000;
const FIRST_SCAN_DELAY_MS = 15000;
const SCAN_EVERY_MS = 6 * 60 * 60 * 1000;

const TABLE = 'study_materials';

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

export const materialSchema = {
  type: Type.OBJECT,
  properties: {
    flashcards: flashcardsSchema,
    practice: questionsSchema,
  },
  required: ['flashcards', 'practice'],
};

// ---------- small helpers ----------

export function cleanFlashcards(raw, limit = FLASHCARD_COUNT) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter((c) => c && typeof c.term === 'string' && typeof c.definition === 'string')
    .map((c) => ({ term: c.term.trim(), definition: c.definition.trim() }))
    .filter((c) => c.term && c.definition)
    .filter((c) => {
      const key = normTitle(c.term);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function pickPracticeSubset(pool, count = PRACTICE_SERVE_COUNT) {
  return shuffle(pool || [])
    .slice(0, count)
    .map((q) => ({ ...q, options: shuffle(q.options || []) }));
}

function dedupeQuestions(questions) {
  const seen = new Set();
  return (questions || []).filter((q) => {
    const key = normTitle(q.question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ai_lessons rows are weeks; this flattens them into one entry per lesson
// (lessons that share a title are merged so nothing is lost)
function extractLessons(rows) {
  const lessons = new Map();
  (rows || []).forEach((row) => {
    const subject = String(row.title || '').trim();
    const list = row.parsed_content && row.parsed_content.lessons;
    if (!subject || !Array.isArray(list)) return;
    const subjectKey = normTitle(subject);

    list.forEach((lesson) => {
      const module = String(lessonName(lesson) || '').trim();
      if (!module) return;
      const lessonKey = normTitle(module);
      const id = `${subjectKey}|${lessonKey}`;
      const text = String(lesson.core_text ?? JSON.stringify(lesson));

      const existing = lessons.get(id);
      if (existing) existing.text += `\n\n${text}`;
      else lessons.set(id, { id, subject, subjectKey, module, lessonKey, text });
    });
  });

  lessons.forEach((lesson) => {
    lesson.text = lesson.text.slice(0, MAX_LESSON_CHARS);
    lesson.hash = createHash('sha256')
      .update(`${GENERATOR_VERSION}:${lesson.text}`)
      .digest('hex')
      .slice(0, 16);
  });
  return lessons;
}

// Takes questions turn by turn from each lesson so every lesson is represented
function mergeRoundRobin(lists, cap) {
  const merged = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && merged.length < cap; i++) {
    for (const list of lists) {
      if (i < list.length && merged.length < cap) merged.push(list[i]);
    }
  }
  return merged;
}

const shape = (subject, module, row) => {
  const flashcards = row.flashcards || [];
  const practicePool = row.practice_pool || row.practice_questions || [];
  return {
    subject,
    module,
    subjectTitle: subject,
    moduleTitle: module,
    version: row.content_hash,
    generated_at: row.generated_at,
    flashcards,
    practice_pool: practicePool,
    practice_quiz: pickPracticeSubset(practicePool, PRACTICE_SERVE_COUNT),
  };
};

// ---------- Gemini ----------

async function generateMaterial(ai, lesson) {
  let best = { flashcards: [], practice: [] };
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prompt = `
        You are preparing offline study material for Alternative Learning System (ALS) students.
        Use ONLY the lesson below.

        Lesson title: ${lesson.module}
        Lesson content:
        ${lesson.text}

        Create:
        1) "flashcards": exactly ${FLASHCARD_COUNT} flashcards. Each has a short "term" and a clear
           "definition" (maximum 2 sentences, simple language). Every term must be different.
        2) "practice": exactly ${PRACTICE_POOL_COUNT} DIFFERENT multiple-choice questions.
           - Exactly 4 options and exactly ONE correct answer.
           - "correct_answer" must be copied EXACTLY as one of the strings in "options".
           - Cover different parts of the lesson; never repeat the same idea.
           - Questions must make sense on their own (do not say "according to the text").
           - No "all of the above" or "none of the above" options.
           - Use clear, simple language.

        Output ONLY JSON like:
        {"flashcards":[{"term":"...","definition":"..."}],
         "practice":[{"question":"...","options":["A","B","C","D"],"correct_answer":"B"}]}
      `;

      const model = attempt > 1 && fallbackModel() ? fallbackModel() : GEMINI_MODEL;
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema: materialSchema,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Gemini returned an empty response');

      const parsed = JSON.parse(text);
      const flashcards = cleanFlashcards(parsed.flashcards, FLASHCARD_COUNT);
      const practice = dedupeQuestions(cleanQuestions(parsed.practice, PRACTICE_POOL_COUNT * 2)).slice(
        0,
        PRACTICE_POOL_COUNT
      );

      if (flashcards.length + practice.length > best.flashcards.length + best.practice.length) {
        best = { flashcards, practice };
      }
      if (flashcards.length >= MIN_FLASHCARDS && practice.length >= MIN_PRACTICE) {
        return { flashcards, practice };
      }
      throw new Error('Gemini returned too few valid items');
    } catch (error) {
      lastError = error;
      console.error(`Study material attempt ${attempt}/${MAX_ATTEMPTS} failed (${lesson.module}):`, errorText(error));
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
      await sleep(RETRY_BASE_MS * attempt);
    }
  }

  if (best.flashcards.length > 0 || best.practice.length > 0) return best;
  throw lastError;
}

// ---------- routes + background worker ----------

export function registerStudyMaterials(app, { supabase, admin, ai }) {
  const db = admin || supabase;
  const inFlight = new Map(); // lesson id -> Promise (so two requests never generate twice)
  const queue = [];
  const queued = new Set();
  let currentRun = null;

  async function loadLessons(subjectTitle) {
    const select = () => supabase.from('ai_lessons').select('title, parsed_content');
    let rows = [];

    if (subjectTitle) {
      const exact = await select().eq('title', subjectTitle);
      if (exact.error) throw exact.error;
      rows = exact.data || [];
      if (rows.length === 0) {
        // Title may differ by case/spaces: look through all subjects
        const all = await select();
        if (all.error) throw all.error;
        rows = (all.data || []).filter((r) => normTitle(r.title) === normTitle(subjectTitle));
      }
    } else {
      const all = await select();
      if (all.error) throw all.error;
      rows = all.data || [];
    }
    return extractLessons(rows);
  }

  async function readStored(lesson) {
    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .eq('subject_key', lesson.subjectKey)
      .eq('lesson_key', lesson.lessonKey)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // Returns the stored row if it is up to date, otherwise generates + stores it
  function ensureMaterial(lesson) {
    if (inFlight.has(lesson.id)) return inFlight.get(lesson.id);

    const promise = (async () => {
      const stored = await readStored(lesson);
      if (stored && stored.content_hash === lesson.hash) return stored;

      const generated = await generateMaterial(ai, lesson);
      const row = {
        subject_title: lesson.subject,
        lesson_title: lesson.module,
        subject_key: lesson.subjectKey,
        lesson_key: lesson.lessonKey,
        content_hash: lesson.hash,
        flashcards: generated.flashcards,
        practice_pool: generated.practice,
        generated_at: new Date().toISOString(),
      };
      const { error } = await db.from(TABLE).upsert(row, { onConflict: 'subject_key,lesson_key' });
      if (error) throw error;
      return row;
    })().finally(() => inFlight.delete(lesson.id));

    inFlight.set(lesson.id, promise);
    return promise;
  }

  function runQueue() {
    if (currentRun) return currentRun;
    currentRun = Promise.resolve().then(async () => {
      try {
        while (queue.length > 0) {
          const lesson = queue.shift();
          queued.delete(lesson.id);
          try {
            await ensureMaterial(lesson);
            console.log(`✅ Study material ready: ${lesson.subject} / ${lesson.module}`);
          } catch (error) {
            console.error(`❌ Study material failed: ${lesson.subject} / ${lesson.module}:`, errorText(error));
            if (error?.code === '42P01' || error?.code === 'PGRST205') {
              console.error('👉 The study_materials table is missing. Run study_materials.sql in Supabase.');
            }
          }
          if (queue.length > 0 && GAP_BETWEEN_JOBS_MS > 0) await sleep(GAP_BETWEEN_JOBS_MS);
        }
      } finally {
        currentRun = null;
      }
    });
    return currentRun;
  }

  function enqueue(lessons) {
    let added = 0;
    for (const lesson of lessons) {
      if (queued.has(lesson.id) || inFlight.has(lesson.id)) continue;
      queued.add(lesson.id);
      queue.push(lesson);
      added++;
    }
    if (added > 0) runQueue();
    return added;
  }

  // Queues every lesson (optionally only one subject) that has no up-to-date material
  async function queueMissing(subjectTitle) {
    const lessons = [...(await loadLessons(subjectTitle)).values()];
    const { data, error } = await db.from(TABLE).select('subject_key, lesson_key, content_hash');
    if (error) throw error;

    const have = new Map((data || []).map((r) => [`${r.subject_key}|${r.lesson_key}`, r.content_hash]));
    const missing = lessons.filter((l) => have.get(l.id) !== l.hash);
    if (missing.length > 0) console.log(`📚 Preparing study material for ${missing.length} lesson(s)...`);
    return enqueue(missing);
  }

  function startBackfill() {
    const scan = () =>
      queueMissing().catch((error) => {
        console.error('Study material scan failed:', errorText(error));
        if (error?.code === '42P01' || error?.code === 'PGRST205') {
          console.error('👉 The study_materials table is missing. Run study_materials.sql in Supabase.');
        }
      });
    const first = setTimeout(scan, FIRST_SCAN_DELAY_MS);
    const repeat = setInterval(scan, SCAN_EVERY_MS);
    first.unref?.();
    repeat.unref?.();
  }

  async function whenIdle() {
    while (currentRun) await currentRun;
  }

  function sendError(res, error) {
    console.error('Study material request failed:', errorText(error));
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      console.error('👉 The study_materials table is missing. Run study_materials.sql in Supabase.');
    }
    if (isRateLimited(error)) {
      return res.status(429).json({ error: 'The AI is busy right now. Please wait a minute and try again.' });
    }
    return res
      .status(500)
      .json({ error: "We couldn't prepare this study material right now. Please try again in a moment." });
  }

  async function handleStudyMaterialRequest(req, res) {
    res.set('Cache-Control', 'no-store');
    try {
      const subjectTitle = cleanParam(req.query.subjectTitle);
      const moduleTitle = cleanParam(req.query.moduleTitle);
      if (!subjectTitle) return res.status(400).json({ error: 'subjectTitle is required.' });

      const lessons = [...(await loadLessons(subjectTitle)).values()];
      if (lessons.length === 0) return res.status(404).json({ error: 'Subject not found in database.' });

      const subjectName = lessons[0].subject;
      const wantAll = !moduleTitle || normTitle(moduleTitle) === normTitle(subjectTitle);

      // ----- one lesson -----
      if (!wantAll) {
        const lesson = lessons.find((l) => l.lessonKey === normTitle(moduleTitle));
        if (!lesson) return res.status(404).json({ error: 'Specific module content not found.' });
        const row = await ensureMaterial(lesson);
        return res.json(shape(lesson.subject, lesson.module, row));
      }

      // ----- whole subject: merge the lessons that are ready -----
      const { data: storedRows, error } = await db
        .from(TABLE)
        .select('*')
        .eq('subject_key', lessons[0].subjectKey);
      if (error) throw error;

      const storedById = new Map((storedRows || []).map((r) => [`${r.subject_key}|${r.lesson_key}`, r]));
      const ready = new Map();
      const notReady = [];
      lessons.forEach((lesson) => {
        const row = storedById.get(lesson.id);
        if (row && row.content_hash === lesson.hash) ready.set(lesson.id, row);
        else notReady.push(lesson);
      });

      enqueue(notReady); // the rest keeps being prepared in the background

      const poolSize = () => [...ready.values()].reduce((n, r) => n + (r.practice_pool || []).length, 0);
      let generatedNow = 0;
      for (const lesson of notReady) {
        if (poolSize() >= PRACTICE_POOL_COUNT || generatedNow >= MAX_ON_DEMAND_LESSONS) break;
        ready.set(lesson.id, await ensureMaterial(lesson));
        generatedNow++;
      }

      const rows = lessons.filter((l) => ready.has(l.id)).map((l) => ready.get(l.id));
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Specific module content not found.' });
      }

      const version = createHash('sha256')
        .update(rows.map((r) => r.content_hash).sort().join(','))
        .digest('hex')
        .slice(0, 16);

      const flashcards = mergeRoundRobin(rows.map((r) => r.flashcards || []), 30);
      const practicePool = mergeRoundRobin(rows.map((r) => r.practice_pool || []), SUBJECT_POOL_CAP);

      res.json({
        subject: subjectName,
        module: '',
        subjectTitle: subjectName,
        moduleTitle: '',
        version,
        generated_at: rows.map((r) => r.generated_at).sort().pop(),
        flashcards,
        practice_pool: practicePool,
        practice_quiz: pickPracticeSubset(practicePool, PRACTICE_SERVE_COUNT),
      });
    } catch (error) {
      sendError(res, error);
    }
  }

  // Register both routes so legacy and updated clients work seamlessly
  app.get('/api/study-materials', handleStudyMaterialRequest);
  app.get('/api/study-pack', handleStudyMaterialRequest);

  // Lesson object in the same shape extractLessons() builds
  function makeLesson(subject, module, text) {
    const subjectKey = normTitle(subject);
    const lessonKey = normTitle(module);
    const clipped = String(text || '').slice(0, MAX_LESSON_CHARS);
    return {
      id: `${subjectKey}|${lessonKey}`,
      subject,
      subjectKey,
      module,
      lessonKey,
      text: clipped,
      hash: createHash('sha256').update(`${GENERATOR_VERSION}:${clipped}`).digest('hex').slice(0, 16),
    };
  }

  // Stored flashcards/practice for one lesson, or merged across the subject when no lesson is given.
  // Returns null when nothing is stored yet.
  async function getStoredMaterials(subjectTitle, moduleTitle) {
    const subjectKey = normTitle(subjectTitle);
    const lessonKey = normTitle(moduleTitle);

    if (!lessonKey || lessonKey === subjectKey) {
      const { data, error } = await db.from(TABLE).select('*').eq('subject_key', subjectKey);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const flashcards = mergeRoundRobin(data.map((r) => r.flashcards || []), 30);
      const practice_pool = mergeRoundRobin(data.map((r) => r.practice_pool || []), SUBJECT_POOL_CAP);
      return {
        flashcards,
        practice_pool,
        practice_questions: practice_pool,
      };
    }

    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .eq('subject_key', subjectKey)
      .eq('lesson_key', lessonKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      practice_questions: data.practice_pool || [],
    };
  }

  // Used when nothing is stored yet. A single lesson is generated AND saved for next time.
  // A whole subject is generated from the combined text and returned (each lesson is saved
  // separately by the background job).
  async function ensureMaterials(subjectTitle, moduleTitle, contentText) {
    const subjectKey = normTitle(subjectTitle);
    const lessonKey = normTitle(moduleTitle);

    if (lessonKey && lessonKey !== subjectKey) {
      const row = await ensureMaterial(makeLesson(subjectTitle, moduleTitle, contentText));
      const pool = row.practice_pool || [];
      return { flashcards: row.flashcards || [], practice_pool: pool, practice_questions: pool };
    }

    const generated = await generateMaterial(ai, {
      module: subjectTitle,
      text: String(contentText || '').slice(0, MAX_LESSON_CHARS),
    });
    return {
      flashcards: generated.flashcards || [],
      practice_pool: generated.practice || [],
      practice_questions: generated.practice || [],
    };
  }

  return {
    getStoredMaterials,
    ensureMaterials,
    queueSubject: (subjectTitle) => queueMissing(subjectTitle),
    queueMissing,
    startBackfill,
    whenIdle,
    pickPracticeSubset,
  };
}