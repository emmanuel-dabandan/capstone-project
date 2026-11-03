import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors({
  origin: '*', // Allows your mobile app to connect from any network
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
const upload = multer({ dest: 'uploads/' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("❌ ERROR: Supabase keys are missing!");
  console.log("🔍 Here are the exact variable names found in your .env file:");
  console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('VITE') || k.includes('EXPO')));
  console.log("👉 Please check the names above and make sure your .env has values assigned to them.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiKey });

// --- 🟢 AI RECOMMENDATION ROUTE ---
app.get('/api/ai-recommendation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: grades, error } = await supabase
      .from('quiz_grades')
      .select('module_title, score, total_items, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!grades || grades.length === 0) {
      return res.json({
        target_module: "Fundamentals of Hypothesis Testing",
        rationale: "Complete your first evaluation to unlock personalized insights."
      });
    }

    const prompt = `
      Analyze this student's recent quiz grades: ${JSON.stringify(grades)}.
      Identify the module where they struggled the most (lowest percentage).
      Output ONLY a JSON object exactly like this:
      {
        "target_module": "Name of the exact module they should review",
        "rationale": "A short, encouraging 1-sentence explanation of why they need to review this."
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            target_module: { type: Type.STRING },
            rationale: { type: Type.STRING }
          },
          required: ["target_module", "rationale"]
        }
      }
    });

    res.json(JSON.parse(response.text));

  } catch (error) {
    console.error("AI Recommendation Error:", error);
    res.json({
      target_module: "Testing Hypothesis",
      rationale: "Review your recent concepts to improve your mastery."
    });
  }
});

// --- 🟢 NEW FLASHCARD GENERATOR ROUTE ---
app.get('/api/generate-flashcards', async (req, res) => {
  try {
    const { subjectTitle, moduleTitle } = req.query;

    const { data, error } = await supabase
      .from('ai_lessons')
      .select('parsed_content')
      .eq('title', subjectTitle || '');

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Subject not found in database." });
    }

    let contentToReview = "";
    data.forEach(row => {
      if (row.parsed_content && row.parsed_content.lessons) {
        row.parsed_content.lessons.forEach(lesson => {
          if (!moduleTitle || lesson.lesson_title === moduleTitle || lesson.title === moduleTitle) {
            contentToReview += JSON.stringify(lesson) + " ";
          }
        });
      }
    });

    if (!contentToReview) {
       return res.status(404).json({ error: "Specific module content not found." });
    }

    const prompt = `
      Based on the following educational content, generate 10 highly effective study flashcards.
      Content: ${contentToReview}

      Output ONLY a JSON array of objects, where each object has exactly two keys: "term" and "definition".
      Example: [{"term": "Photosynthesis", "definition": "The process by which plants make food."}]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["term", "definition"]
          }
        }
      }
    });

    res.json(JSON.parse(response.text));

  } catch (error) {
    console.error("Flashcard generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 🟢 PDF UPLOAD ROUTE ---
app.post('/api/upload-lesson', upload.single('pdf'), async (req, res) => {
  try {
    const selectedSubject = req.body.subject || 'Uncategorized';

    console.log(`--- UPLOADING MODULE FOR: ${selectedSubject} ---`);
    console.log("1. Receiving PDF and uploading to Gemini...");

    const uploadResult = await ai.files.upload({
      file: req.file.path,
      config: { mimeType: 'application/pdf' }
    });

    console.log("2. Parsing with Gemini 1.5 Flash...");
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
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
      config: {
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
    });

    const parsedJsonData = JSON.parse(response.text);
    console.log("3. Pushing to Supabase...");

    const { data, error } = await supabase
      .from('ai_lessons')
      .insert([{
          title: selectedSubject,
          subtitle: req.file.originalname.replace('.pdf', ''),
          progress: 0,
          parsed_content: parsedJsonData
      }]);

    if (error) throw error;

    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `✅ Success! Lesson added to ${selectedSubject}.` });

  } catch (error) {
    console.error(error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🟢 Dynamically grab the port Render provides, or default to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend running on port ${PORT}`));