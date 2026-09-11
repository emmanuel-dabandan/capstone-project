import os
from fastapi import FastAPI
from dotenv import load_dotenv
from google import genai
from database import supabase

# Load environment variables
load_dotenv()

# Initialize the modern Gemini client
# It will automatically look for the GEMINI_API_KEY in your .env file!
client = genai.Client()

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello from the ASCEND API!"}

@app.get("/db-check")
def test_database():
    if supabase:
        return {"status": "success", "message": "Supabase is connected!"}
    return {"status": "error", "message": "Failed to connect to Supabase."}

@app.get("/generate-quiz")
def generate_quiz(topic: str):
    prompt = f"Create a simple 3-question multiple choice quiz about {topic} for an Alternative Learning System (ALS) student. Provide the answer key at the bottom."
    
    # Call the Gemini AI using the modern syntax
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt
    )
    
    return {"topic": topic, "quiz": response.text}
