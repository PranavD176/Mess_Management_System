"""
config.py — Load environment variables
"""
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL: str = os.environ["DATABASE_URL"]
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

JWT_SECRET: str = os.environ["JWT_SECRET"]
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
