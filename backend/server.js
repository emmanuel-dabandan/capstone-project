import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  registerAssessmentRoutes,
  pickModelForAttempt,
  parseJsonText,
  sleep,
  isRetryable,
  errorText,
  normTitle,
  lessonName,
  cleanParam,
} from './assessmentRoutes.js';
import { pickRecommendationTarget } from './recommendation.js';
import { registerStudyMaterials } from './studyMaterials.js';

dotenv.config();

// Ensure uploads folder always exists (optional with memory storage, but safe to keep)
fs.mkdirSync('uploads', { recursive: true });

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Use memory storage to prevent filesystem errors on cloud platforms like Render
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_KEY;

const geminiKey =
  process.env.GEMINI_API_KEY ||
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Supabase keys are missing! Check your .env or environment variables.");
  process.exit(1);
}

if (!geminiKey) {
  console.error("❌ ERROR: GEMINI_API_KEY is missing! Add GEMINI_API_KEY to your .env or hosting environment.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiKey });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;
if (!serviceRoleKey) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is not set: saving lessons/materials with the regular key.");
}

// Helper for 503/model-resilient Gemini calls across server.js routes
async function generateWithRetry(contents, config, maxAttempts = 4) {
  const baseMs = Number(process.env.GEMINI_RETRY_BASE_MS) || 2000;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = pickModelForAttempt(attempt);
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return parseJsonText(response?.text);
    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt}/${maxAttempts} (${model}) failed:`, errorText(error));
      if (!isRetryable(error) || attempt === maxAttempts) break;
      await sleep(baseMs * attempt);
    }
  }
  throw lastError;
}

// Register on-demand flashcard (10) + practice pool (20) generator
const studyMaterials = registerStudyMaterials(app, { supabase, admin: supabaseAdmin, ai });

// --- 🟢 AI RECOMMENDATION ROUTE ---
app.get('/api/ai-recommendation/:userId', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { userId } = req.params;

    const { data: lessonRows, error: lessonsError } = await supabase
      .from('ai_lessons')
      .select('title, progress');
    if (lessonsError) throw lessonsError;

    const { data: grades, error: gradesError } = await supabase
      .from('quiz_grades')
      .select('module_title, score, total_items')
      .eq('student_id', userId)
      .limit(50);
    if (gradesError) throw gradesError;

    const pick = pickRecommendationTarget(lessonRows, grades);
    if (!pick) {
      return res.status(404).json({ error: "No lessons have been uploaded yet." });
    }

    // Use data-based rationale by default to save free-tier daily quota, or generate if quota allows
    let rationale = pick.fallbackRationale;
    try {
      const parsed = await generateWithRetry(
        `
          Write ONE short, encouraging sentence (maximum 25 words) telling an Alternative Learning System student why they should review or continue a subject.
          Facts: ${pick.facts}
          Do not mention any other subject. Output ONLY a JSON object: {"rationale": "..."}
        `,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { rationale: { type: Type.STRING } },
            required: ["rationale"]
          }
        },
        1
      );
      if (typeof parsed?.rationale === 'string' && parsed.rationale.trim()) {
        rationale = parsed.rationale.trim();
      }
    } catch (aiError) {
      console.error("Rationale generation failed, using data-based text:", aiError.message);
    }

    res.json({ target_module: pick.target_module, rationale });

  } catch (error) {
    console.error("AI Recommendation Error:", error);
    res.status(500).json({ error: "Could not load a recommendation." });
  }
});

// --- 🟢 FLASHCARD ROUTE ---
app.get('/api/generate-flashcards', async (req, res) => {
  try {
    const subjectTitle = cleanParam(req.query.subjectTitle);
    const moduleTitle = cleanParam(req.query.moduleTitle);

    if (!subjectTitle) {
      return res.status(400).json({ error: "subjectTitle is required." });
    }

    const stored = await studyMaterials.getStoredMaterials(subjectTitle, moduleTitle);
    if (stored && stored.flashcards && stored.flashcards.length > 0) {
      return res.json(stored.flashcards);
    }

    const { data, error } = await supabase
      .from('ai_lessons')
      .select('parsed_content')
      .eq('title', subjectTitle);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Subject not found in database." });
    }

    const wantAll = !moduleTitle || normTitle(moduleTitle) === normTitle(subjectTitle);
    let contentToReview = "";
    data.forEach(row => {
      if (row.parsed_content && Array.isArray(row.parsed_content.lessons)) {
        row.parsed_content.lessons.forEach(lesson => {
          const name = lessonName(lesson);
          if (wantAll || normTitle(name) === normTitle(moduleTitle)) {
            contentToReview += `LESSON: ${name}\n${lesson.core_text ?? lesson.full_module_text ?? JSON.stringify(lesson)}\n\n`;
          }
        });
      }
    });

    if (!contentToReview.trim()) {
      return res.status(404).json({ error: "Specific module content not found." });
    }

    const built = await studyMaterials.ensureMaterials(
      subjectTitle,
      moduleTitle,
      contentToReview.slice(0, 60000)
    );

    res.json(built.flashcards);

  } catch (error) {
    console.error("Flashcard generation error:", error);
    res.status(500).json({ error: errorText(error) });
  }
});

// --- 🟢 PDF UPLOAD HANDLER (Memory Buffer Based) ---
async function handleLessonUpload(req, res) {
  const uploadedFile = req.file || (Array.isArray(req.files) && req.files[0]);

  try {
    if (!uploadedFile || !uploadedFile.buffer) {
      return res.status(400).json({ success: false, error: "No PDF file was received in the request." });
    }
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is missing on the server.");
    }

    const selectedSubject = (req.body?.subject || req.body?.title || 'Uncategorized').trim();

    console.log(`--- UPLOADING MODULE FOR: ${selectedSubject} ---`);
    console.log(`1. Preparing PDF (${uploadedFile.originalname}, ${uploadedFile.size} bytes) in memory...`);

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: uploadedFile.buffer.toString('base64'),
      },
    };

    console.log("2. Parsing PDF with Gemini (with model fallback & retry protection)...");
    const parsedJsonData = await generateWithRetry(
      [
        pdfPart,
        `Analyze the provided educational PDF and transform it into a structured, self-paced learning module for Alternative Learning System (ALS) students. Follow these strict guidelines:

        1. 5-Part Structure: Divide the core instructional content sequentially into exactly 5 distinct learning sections (lessons).
        2. AI Overview & Key Concepts: For each lesson, provide:
           - "overview_title": A concise title for the AI summary card.
           - "overview_body": A clear 3-5 sentence summary explaining the core takeaway of the section.
           - "key_concepts": An array of 2 to 4 key concepts, each with "concept_title" and "concept_body".
        3. Full Module Text: Provide comprehensive instructional explanations, examples, and step-by-step teaching content inside "full_module_text" (and copy the same text to "core_text" for backward compatibility, aiming for 300 to 500 words per section).
        4. Interactive Activity: For each lesson, create an "activity" object with:
           - "activity_type": "multiple_choice"
           - "question_prompt": A clear comprehension or application question based on that lesson.
           - "options": An array of 4 distinct answer choices.
           - "correct_answer": Must match one of the 4 strings in "options" EXACTLY.
        5. Exclusions: Entirely skip and exclude any group activities, pair work, or classroom exercises.

        Output ONLY a valid JSON object matching the requested schema.`
      ],
      {
        temperature: 0.3,
        maxOutputTokens: 32768,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            module_title: { type: Type.STRING },
            module_subtitle: { type: Type.STRING },
            total_estimated_time: { type: Type.INTEGER },
            lessons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  lesson_title: { type: Type.STRING },
                  duration_minutes: { type: Type.INTEGER },
                  type: { type: Type.STRING },
                  overview_title: { type: Type.STRING },
                  overview_body: { type: Type.STRING },
                  key_concepts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        concept_title: { type: Type.STRING },
                        concept_body: { type: Type.STRING }
                      },
                      required: ["concept_title", "concept_body"]
                    }
                  },
                  full_module_text: { type: Type.STRING },
                  core_text: { type: Type.STRING },
                  knowledge_check_question: { type: Type.STRING },
                  activity: {
                    type: Type.OBJECT,
                    properties: {
                      activity_type: { type: Type.STRING },
                      question_prompt: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      },
                      correct_answer: { type: Type.STRING }
                    },
                    required: ["activity_type", "question_prompt", "options", "correct_answer"]
                  }
                },
                required: [
                  "lesson_title",
                  "duration_minutes",
                  "type",
                  "overview_title",
                  "overview_body",
                  "key_concepts",
                  "full_module_text",
                  "core_text",
                  "activity"
                ]
              }
            }
          },
          required: ["module_title", "module_subtitle", "total_estimated_time", "lessons"]
        }
      }
    );

    // Ensure core_text and full_module_text mirror each other if one is omitted
    if (parsedJsonData && Array.isArray(parsedJsonData.lessons)) {
      parsedJsonData.lessons = parsedJsonData.lessons.map((lesson) => ({
        ...lesson,
        core_text: lesson.core_text || lesson.full_module_text || lesson.overview_body || '',
        full_module_text: lesson.full_module_text || lesson.core_text || lesson.overview_body || '',
        knowledge_check_question:
          lesson.knowledge_check_question || lesson.activity?.question_prompt || '',
      }));
    }

    console.log("3. Pushing lesson to Supabase...");
    const rowPayload = [{
      title: selectedSubject,
      subtitle: (uploadedFile.originalname || 'Module').replace(/\.pdf$/i, ''),
      progress: 0,
      parsed_content: parsedJsonData
    }];

    let { error } = await supabaseAdmin.from('ai_lessons').insert(rowPayload);
    if (error && supabaseAdmin !== supabase) {
      console.warn("supabaseAdmin insert failed, retrying with regular supabase client:", error.message);
      const retryInsert = await supabase.from('ai_lessons').insert(rowPayload);
      error = retryInsert.error;
    }
    if (error) throw new Error(`Supabase ai_lessons insert failed: ${error.message}`);

    // NOTE: Disabled automatic background queueing on upload to preserve free-tier daily quota (20 req/day).
    // Study materials (Flashcards & Practice Pool) will generate on-demand when a student opens them and then stay cached in Supabase.
    // Promise.resolve(studyMaterials.queueSubject(selectedSubject))
    //   .catch((e) => console.error("Could not queue study materials:", errorText(e)));

    res.json({
      success: true,
      message: `✅ Success! Lesson added to ${selectedSubject}. Study materials will generate on-demand when opened.`
    });

  } catch (error) {
    console.error("❌ UPLOAD-LESSON ERROR:", error);
    res.status(500).json({
      success: false,
      error: errorText(error) || "Failed to upload and parse lesson."
    });
  }
}

app.post('/api/upload-lesson', upload.any(), handleLessonUpload);
app.post('/api/upload', upload.any(), handleLessonUpload);

// --- 🟢 QUIZ + PRACTICE ROUTES ---
registerAssessmentRoutes(app, { supabase, ai, studyMaterials });

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend running on port ${PORT}`));

// Keep backfill disabled on free tier to avoid exhausting daily quota on server boot
// studyMaterials.startBackfill();