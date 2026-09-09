import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load the hidden variables from your .env file
load_dotenv()

# Retrieve the keys
url: str = os.environ.get("https://vygmnpwccbtwrjsrkpih.supabase.co")
key: str = os.environ.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z21ucHdjY2J0d3Jqc3JrcGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTAxMzUsImV4cCI6MjEwNDQ2NjEzNX0.8wFM3G5jau-xVc2SAKPWJ0BJxKOhUzD9sdXhWWwKoZM")

# Initialize the Supabase connection
supabase: Client = create_client(url, key)