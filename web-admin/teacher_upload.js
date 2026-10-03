import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../backend/.env' });

// 1. Initialize Clients with Fallback Variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Loaded environment variables:", Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('GEMINI')));
  throw new Error("Missing Supabase credentials. Check the printed keys above to verify what names your backend/.env uses.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // Make sure this is in your .env!

async function uploadAndParseLesson() {
  try {
    console.log("1. Uploading PDF to Gemini...");
    // Upload the file to Gemini's servers for processing
    const uploadResult = await ai.files.upload({
      file: 'CGP-Module-5-3rd-Quarter.pdf',
      mimeType: 'application/pdf',
    });

    console.log("2. Parsing PDF into Interactive JSON...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        uploadResult,
        "You are an educational data parser. Read this module and divide it into distinct interactive segments. Output a JSON array containing a lesson_title, brief_summary, and the core_text or activity instructions for that segment."
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
    // Drop it into Supabase mimicking your "Oral Communication" card (ID 2 in your old array)
    const { data, error } = await supabase
      .from('ai_lessons')
      .insert([
        {
          title: 'Oral Communication',
          subtitle: 'Lesson 1: Basics of Speech',
          progress: 0,
          parsed_content: parsedJsonData
        }
      ])
      .select();

    if (error) throw error;
    console.log("✅ Success! Lesson is live in the database:", data[0].id);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

uploadAndParseLesson();