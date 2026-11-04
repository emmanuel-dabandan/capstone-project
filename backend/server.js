import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  registerAssessmentRoutes,
  GEMINI_MODEL,
  fallbackModel,
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

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
const upload = multer({ dest: 'uploads/' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("❌ ERROR: Supabase keys are missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiKey });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;
if (!serviceRoleKey) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is not set: saving study materials with the regular key.");
}

// Helper for 503-resilient Gemini calls across server.js routes
async function generateWithRetry(contents, config, maxAttempts = 4) {
  const baseMs = Number(process.env.GEMINI_RETRY_BASE_MS) || 2000;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const model = attempt > 1 && fallbackModel() ? fallbackModel() : GEMINI_MODEL;
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      if (!response.text) throw new Error('Gemini returned an empty response');
      return JSON.parse(response.text);
    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt}/${maxAttempts} failed:`, errorText(error));
      if (!isRetryable(error) || attempt === maxAttempts) break;
      await sleep(baseMs * attempt);
    }
  }
  throw lastError;
}

// Register automatic background flashcard (10) + practice pool (20) generator
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
        2 // 2 quick attempts, then instant data-driven fallback
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

// --- 🟢 FLASHCARD ROUTE (Serves pre-generated 10 flashcards instantly, or builds & saves them) ---
app.get('/api/generate-flashcards', async (req, res) => {
  try {
    const subjectTitle = cleanParam(req.query.subjectTitle);
    const moduleTitle = cleanParam(req.query.moduleTitle);

    if (!subjectTitle) {
      return res.status(400).json({ error: "subjectTitle is required." });
    }

    // 1. Serve immediately if already prepared in the background
    const stored = await studyMaterials.getStoredMaterials(subjectTitle, moduleTitle);
    if (stored && stored.flashcards && stored.flashcards.length > 0) {
      return res.json(stored.flashcards);
    }

    // 2. Otherwise collect content, generate with retry, and save for next time
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
            contentToReview += `LESSON: ${name}\n${lesson.core_text ?? JSON.stringify(lesson)}\n\n`;
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
    res.status(500).json({ error: error.message });
  }
});

// --- 🟢 PDF UPLOAD ROUTE (With 503 Retries + Automatic Background Study Pack Trigger) ---
app.post('/api/upload-lesson', upload.single('pdf'), async (req, res) => {
  try {
    const selectedSubject = req.body.subject || 'Uncategorized';

    console.log(`--- UPLOADING MODULE FOR: ${selectedSubject} ---`);
    console.log("1. Receiving PDF and uploading to Gemini...");

    const uploadResult = await ai.files.upload({
      file: req.file.path,
      config: { mimeType: 'application/pdf' }
    });

    console.log("2. Parsing PDF with Gemini (with 503 retry protection)...");
    const parsedJsonData = await generateWithRetry(
      [
        { fileData: { mimeType: 'application/pdf', fileUri: uploadResult.uri } },
        `Analyze this educational PDF and divide it into a structured learning module. Entirely skip any group activities and do not include them in your output.
        Output ONLY a valid JSON object matching this exact schema:
        {
          "module_title": "Title of the overall subject/PDF",
          "module_subtitle": "A one-sentence summary of the entire module",
          "total_estimated_time": 64,
          "lessons": [
            {
              "lesson_title": "Name of the specific topic",
              "duration_minutes": 5,
              "type": "reading",
              "core_text": "The actual educational content goes here..."
            }
          ]
        }`
      ],
      {
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
                  core_text: { type: Type.STRING },
                },
                required: ["lesson_title", "duration_minutes", "type", "core_text"]
              }
            }
          },
          required: ["module_title", "module_subtitle", "total_estimated_time", "lessons"]
        }
      }
    );

    console.log("3. Pushing lesson to Supabase...");
    const { error } = await supabaseAdmin
      .from('ai_lessons')
      .insert([{
        title: selectedSubject,
        subtitle: req.file.originalname.replace('.pdf', ''),
        progress: 0,
        parsed_content: parsedJsonData
      }]);

    if (error) throw error;

    // 4. Automatically generate the 10 flashcards + 20 practice questions in the background!
    studyMaterials.queueSubject(selectedSubject)
      .catch((e) => console.error("Could not queue study materials:", e.message));

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: `✅ Success! Lesson added to ${selectedSubject}. Flashcards (10) and Practice Pool (20) are generating automatically in the background.`
    });

  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 🟢 QUIZ + PRACTICE ROUTES ---
registerAssessmentRoutes(app, { supabase, ai, studyMaterials });

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend running on port ${PORT}`));

// Automatically backfill 10 flashcards + 20 practice questions for any existing lessons
studyMaterials.startBackfill();