// assessmentRoutes.js  (put it next to server.js)
//
// Adds the routes the mobile app calls:
//   GET /api/generate-quiz?moduleTitle=<subject title>
//   GET /api/generate-practice?subjectTitle=<subject>[&moduleTitle=<lesson title>][&download=true]
//
// Practice generates a 20-question pool in the background and serves 10 shuffled
// questions per attempt (or all 20 when ?download=true is passed).
import { randomUUID } from 'crypto';
import { Type } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const QUIZ_QUESTION_COUNT = 15;
const PRACTICE_POOL_COUNT = 20;  // 20 questions generated per pool
const PRACTICE_SERVE_COUNT = 10; // 10 questions served per student attempt
const MAX_CONTENT_CHARS = 60000;

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS) || 2000;

export const fallbackModel = () => (process.env.GEMINI_FALLBACK_MODEL || '').trim();

const PRACTICE_FRESH_MS =
  process.env.PRACTICE_FRESH_MS !== undefined ? Number(process.env.PRACTICE_FRESH_MS) : 60 * 60 * 1000;
const PRACTICE_CACHE_MAX = 50;

export const questionsSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correct_answer: { type: Type.STRING },
    },
    required: ['question', 'options', 'correct_answer'],
  },
};

const norm = (s) => String(s ?? '').trim().toLowerCase();

export const normTitle = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const lessonName = (lesson) => lesson.lesson_title || lesson.title || lesson.topic || '';

export const cleanParam = (value) => {
  const v = String(value ?? '').trim();
  return v === 'undefined' || v === 'null' ? '' : v;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const errorStatus = (error) => Number(error?.status ?? error?.code ?? error?.error?.code);
export const errorText = (error) => String(error?.message ?? error ?? '');

export const isRateLimited = (error) =>
  errorStatus(error) === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(errorText(error));

export const isRetryable = (error) =>
  error instanceof SyntaxError ||
  /empty response|too few valid/i.test(errorText(error)) ||
  [429, 500, 502, 503, 504].includes(errorStatus(error)) ||
  /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|ECONNRESET|ETIMEDOUT|fetch failed/i.test(errorText(error));

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cleanQuestions(raw, limit) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (q) =>
        q &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        typeof q.correct_answer === 'string'
    )
    .map((q) => {
      const options = [...new Set(q.options.map((o) => String(o).trim()))].filter(Boolean);
      const match = options.find((o) => norm(o) === norm(q.correct_answer));
      if (options.length < 2 || !match) return null;
      return { question: q.question.trim(), options: shuffle(options), correct_answer: match };
    })
    .filter(Boolean)
    .slice(0, limit);
}

// Shuffles the 20-question pool and slices out 10 questions (or all 20 if downloading)
const drawPracticeSet = (pool, count = PRACTICE_SERVE_COUNT) =>
  shuffle(pool)
    .slice(0, count)
    .map((q) => ({ ...q, options: shuffle(q.options) }));

export function registerAssessmentRoutes(app, { supabase, ai, studyMaterials }) {
  async function collectContent(subjectTitle, moduleTitle) {
    const { data, error } = await supabase
      .from('ai_lessons')
      .select('parsed_content')
      .eq('title', subjectTitle);

    if (error) throw error;
    if (!data || data.length === 0) return { error: 'Subject not found in database.' };

    const wantAll = !moduleTitle || normTitle(moduleTitle) === normTitle(subjectTitle);

    let content = '';
    data.forEach((row) => {
      const lessons = row.parsed_content && row.parsed_content.lessons;
      if (!Array.isArray(lessons)) return;
      lessons.forEach((lesson) => {
        const name = lessonName(lesson);
        if (wantAll || normTitle(name) === normTitle(moduleTitle)) {
          content += `LESSON: ${name}\n${lesson.core_text ?? JSON.stringify(lesson)}\n\n`;
        }
      });
    });

    if (!content.trim()) return { error: 'Specific module content not found.' };
    return { content: content.slice(0, MAX_CONTENT_CHARS) };
  }

  async function generateQuestions({ content, count, style }) {
    const minimumGood = Math.min(5, count);
    let best = [];
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const variationKey = randomUUID();

        const prompt = `
          You are writing a ${style} for Alternative Learning System (ALS) students.
          Using ONLY the educational content below, write ${count} multiple-choice questions.

          Rules:
          - Each question has exactly 4 options and exactly ONE correct answer.
          - "correct_answer" must be copied EXACTLY as one of the strings in "options".
          - Cover different parts of the content; do not repeat the same idea.
          - Questions must make sense on their own (don't say "according to the text").
          - No "all of the above" or "none of the above" options.
          - Use clear, simple language.
          - Variation key (use it to pick different questions than a previous run): ${variationKey}

          Content:
          ${content}

          Output ONLY a JSON array like:
          [{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "B"}]
        `;

        const model = attempt > 1 && fallbackModel() ? fallbackModel() : GEMINI_MODEL;
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 1,
            responseMimeType: 'application/json',
            responseSchema: questionsSchema,
          },
        });

        const text = response.text;
        if (!text) throw new Error('Gemini returned an empty response');

        const questions = cleanQuestions(JSON.parse(text), count);
        if (questions.length > best.length) best = questions;
        if (questions.length >= minimumGood) return questions;
        throw new Error('Gemini returned too few valid questions');
      } catch (error) {
        lastError = error;
        console.error(`Gemini attempt ${attempt}/${MAX_ATTEMPTS} failed:`, errorText(error));
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        await sleep(RETRY_BASE_MS * attempt);
      }
    }

    if (best.length > 0) return best;
    throw lastError;
  }

  function sendGenerationError(res, error, failureMessage) {
    console.error('Question generation failed:', error);
    if (isRateLimited(error)) {
      return res
        .status(429)
        .json({ error: 'The AI is busy right now. Please wait a minute and try again.' });
    }
    return res.status(500).json({ error: failureMessage });
  }

  app.get('/', (req, res) => res.json({ ok: true, service: 'als-backend' }));

  // --- FORMAL ASSESSMENT ---
  app.get('/api/generate-quiz', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const subjectTitle = cleanParam(req.query.moduleTitle || req.query.subjectTitle);
      if (!subjectTitle) return res.status(400).json({ error: 'moduleTitle is required.' });

      const result = await collectContent(subjectTitle);
      if (result.error) return res.status(404).json({ error: result.error });

      const questions = await generateQuestions({
        content: result.content,
        count: QUIZ_QUESTION_COUNT,
        style: 'formal end-of-module assessment (mixed easy, medium and hard questions)',
      });

      res.json(questions);
    } catch (error) {
      sendGenerationError(res, error, 'Could not generate the assessment. Please try again.');
    }
  });

  // --- PRACTICE SESSION (20-item pool in DB/Cache -> serves 10 shuffled per try, or 20 if ?download=true) ---
  const practiceCache = new Map(); // key -> { at, pool }

  app.get('/api/generate-practice', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const subjectTitle = cleanParam(req.query.subjectTitle);
      const moduleTitle = cleanParam(req.query.moduleTitle);
      const wantFullDownload = req.query.download === 'true' || req.query.fullPool === 'true';

      if (!subjectTitle) return res.status(400).json({ error: 'subjectTitle is required.' });

      const desiredCount = wantFullDownload ? PRACTICE_POOL_COUNT : PRACTICE_SERVE_COUNT;

      // 1. Check pre-generated background database store first (instant, no Gemini call needed)
      if (studyMaterials) {
        const stored = await studyMaterials.getStoredMaterials(subjectTitle, moduleTitle);
        if (stored && stored.practice_questions && stored.practice_questions.length >= PRACTICE_SERVE_COUNT) {
          return res.json(drawPracticeSet(stored.practice_questions, desiredCount));
        }
      }

      // 2. Check in-memory 20-item pool cache
      const cacheKey = `${normTitle(subjectTitle)}|${normTitle(moduleTitle)}`;
      const cached = practiceCache.get(cacheKey);
      if (cached && Date.now() - cached.at < PRACTICE_FRESH_MS) {
        return res.json(drawPracticeSet(cached.pool, desiredCount));
      }

      // 3. Fallback: Generate the 20-item pool now and save it for all future attempts
      const result = await collectContent(subjectTitle, moduleTitle || undefined);
      if (result.error) return res.status(404).json({ error: result.error });

      let pool;
      try {
        if (studyMaterials) {
          const built = await studyMaterials.ensureMaterials(subjectTitle, moduleTitle, result.content);
          pool = built.practice_questions;
        } else {
          pool = await generateQuestions({
            content: result.content,
            count: PRACTICE_POOL_COUNT,
            style: 'friendly ungraded practice quiz that helps students review (mostly easy to medium)',
          });
        }
      } catch (error) {
        if (cached) {
          console.error('Gemini failed, serving from last 20-item practice pool:', errorText(error));
          return res.json(drawPracticeSet(cached.pool, desiredCount));
        }
        throw error;
      }

      practiceCache.delete(cacheKey);
      practiceCache.set(cacheKey, { at: Date.now(), pool });
      while (practiceCache.size > PRACTICE_CACHE_MAX) {
        practiceCache.delete(practiceCache.keys().next().value);
      }

      res.json(drawPracticeSet(pool, desiredCount));
    } catch (error) {
      sendGenerationError(res, error, 'Could not generate practice questions. Please try again.');
    }
  });
}