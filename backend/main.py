from fastapi import FastAPI
from database import supabase

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello from the ASCEND API!"}

@app.get("/db-check")
def test_database():
    # If the client initialized correctly, this will return successfully
    if supabase:
        return {"status": "success", "message": "Supabase is connected!"}
    return {"status": "error", "message": "Failed to connect to Supabase."}