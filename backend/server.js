import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
// Explicitly allow your frontend Codespace URL to talk to this backend
app.use(cors({
  origin: 'https://glorious-happiness-x5955j7qpxqgfp4p9-5173.app.github.dev',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
const upload = multer({ dest: 'uploads/' }); // Temporarily stores the PDF

// 1. Try to catch the variables using any common prefix
// 1. Try to catch the variables using any common prefix
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// 2. DEBUG CHECK: If they are still missing, print out what the .env actually contains
if (!supabaseUrl || !supabaseKey) {
  console.log("❌ ERROR: Supabase keys are missing!");
  console.log("🔍 Here are the exact variable names found in your .env file:");
  console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('VITE') || k.includes('EXPO')));
  console.log("👉 Please check the names above and make sure your .env has values assigned to them.");
  process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiKey });

app.post('/api/upload-lesson', upload.single('pdf'), async (req, res) => {
  try {
    console.log("--- RUNNING UPDATED CODE ---");
    console.log("1. Receiving PDF and uploading to Gemini...");
    
    const uploadResult = await ai.files.upload({
      file: req.file.path,
      config: {
        mimeType: 'application/pdf', 
      }
    });

    console.log("2. Parsing with Gemini 2.0 Flash...");
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        // 🟢 Explicitly tell Gemini to use the uploaded file's URI
        {
          fileData: {
            mimeType: 'application/pdf',
            fileUri: uploadResult.uri
          }
        },
        "You are an educational data parser. Read this module and divide it into distinct interactive segments. Entirely skip any group activities and do not include them in your output. Output a JSON array containing a lesson_title, brief_summary, and the core_text or activity instructions for each segment."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              lesson_title: { type: Type.STRING },
              brief_summary: { type: Type.STRING },
              core_text: { type: Type.STRING },
            },
            required: ["lesson_title", "brief_summary", "core_text"]
          }
        }
      }
    });

    const parsedJsonData = JSON.parse(response.text);
    console.log("3. Pushing to Supabase...");

    const { data, error } = await supabase
      .from('ai_lessons')
      .insert([{
          title: 'Oral Communication',
          subtitle: req.file.originalname.replace('.pdf', ''),
          progress: 0,
          parsed_content: parsedJsonData
      }]);

    if (error) throw error;

    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: "✅ Success! Lesson is live on the mobile app." });

  } catch (error) {
    console.error(error);
    if (req.file) fs.unlinkSync(req.file.path); 
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => console.log('🚀 Backend running on http://localhost:3000'));