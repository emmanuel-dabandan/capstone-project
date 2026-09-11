import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load the hidden variables from your .env file
load_dotenv()

# Retrieve the values by asking for their **NAMES**, not the values themselves
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

# Initialize the Supabase connection (it will now receive the actual values)
supabase: Client = create_client(url, key)