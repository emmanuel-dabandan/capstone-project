// assessmentRoutes.js  (put it next to server.js)
//
// Adds the two routes the mobile app calls but the deployed server was missing:
//   GET /api/generate-quiz?moduleTitle=<subject title>
//   GET /api/generate-practice?subjectTitle=<subject>&moduleTitle=<lesson title>
//
// Both return a JSON array: [{ question, options: [..], correct_answer }]
import { randomUUID } from 'crypto';
import { Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3.1-flash-lite'; // same model your other routes use
const QUIZ_QUESTION_COUNT = 15;               // change to taste
const PRACTICE_QUESTION_COUNT = 10;
const MAX_CONTENT_CHARS = 60000;              // keeps the prompt a sane size

const questionsSchema = {
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Keeps only well-formed questions whose correct_answer really is one of the
// options (the app compares them as text), and shuffles the option order so the
// right answer isn't always in the same spot.
function cleanQuestions(raw, limit) {
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

export function registerAssessmentRoutes(app, { supabase, ai }) {
  // Collects lesson text for a subject (all weeks), optionally only one lesson.
  async function collectContent(subjectTitle, moduleTitle) {
    const { data, error } = await supabase
      .from('ai_lessons')
      .select('parsed_content')
      .eq('title', subjectTitle);

    if (error) throw error;
    if (!data || data.length === 0) return { error: 'Subject not found in database.' };

    let content = '';
    data.forEach((row) => {
      const lessons = row.parsed_content && row.parsed_content.lessons;
      if (!Array.isArray(lessons)) return;
      lessons.forEach((lesson) => {
        const name = lesson.lesson_title || lesson.title;
        if (!moduleTitle || name === moduleTitle) {
          content += `LESSON: ${name}\n${lesson.core_text ?? JSON.stringify(lesson)}\n\n`;
        }
      });
    });

    if (!content.trim()) return { error: 'Specific module content not found.' };
    return { content: content.slice(0, MAX_CONTENT_CHARS) };
  }

  async function generateQuestions({ content, count, style }) {
    const variationKey = randomUUID(); // makes every request produce a different set

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

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 1,
        responseMimeType: 'application/json',
        responseSchema: questionsSchema,
      },
    });

    return cleanQuestions(JSON.parse(response.text), count);
  }

  // Simple health check: also useful for waking Render up before the app calls it.
  app.get('/', (req, res) => res.json({ ok: true, service: 'als-backend' }));

  // --- FORMAL ASSESSMENT (the app sends the subject title as "moduleTitle") ---
  app.get('/api/generate-quiz', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const subjectTitle = String(req.query.moduleTitle || req.query.subjectTitle || '').trim();
      if (!subjectTitle) return res.status(400).json({ error: 'moduleTitle is required.' });

      const result = await collectContent(subjectTitle);
      if (result.error) return res.status(404).json({ error: result.error });

      const questions = await generateQuestions({
        content: result.content,
        count: QUIZ_QUESTION_COUNT,
        style: 'formal end-of-module assessment (mixed easy, medium and hard questions)',
      });

      if (questions.length === 0) {
        return res.status(502).json({ error: 'Could not generate a valid assessment. Please try again.' });
      }
      res.json(questions);
    } catch (error) {
      console.error('Quiz generation error:', error);
      res.status(500).json({ error: 'Could not generate the assessment. Please try again.' });
    }
  });

  // --- PRACTICE SESSION (one lesson, ungraded) ---
  app.get('/api/generate-practice', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const subjectTitle = String(req.query.subjectTitle || '').trim();
      const moduleTitle = String(req.query.moduleTitle || '').trim();
      if (!subjectTitle) return res.status(400).json({ error: 'subjectTitle is required.' });

      const result = await collectContent(subjectTitle, moduleTitle || undefined);
      if (result.error) return res.status(404).json({ error: result.error });

      const questions = await generateQuestions({
        content: result.content,
        count: PRACTICE_QUESTION_COUNT,
        style: 'friendly ungraded practice quiz that helps students review (mostly easy to medium)',
      });

      if (questions.length === 0) {
        return res.status(502).json({ error: 'Could not generate practice questions. Please try again.' });
      }
      res.json(questions);
    } catch (error) {
      console.error('Practice generation error:', error);
      res.status(500).json({ error: 'Could not generate practice questions. Please try again.' });
    }
  });
}