"""
init_users.py — Run once to generate proper bcrypt hashes for default accounts.
Usage: python init_users.py
"""
from passlib.context import CryptContext
import psycopg, os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

USERS = [
    ("admin", "admin@123", "admin"),
    ("staff", "staff@123", "staff"),
]

def main():
    conn = psycopg.connect(os.environ["DATABASE_URL"] + "?sslmode=require")
    cur = conn.cursor()
    for username, password, role in USERS:
        hashed = pwd_context.hash(password)
        cur.execute("""
            INSERT INTO users (username, password, role)
            VALUES (%s, %s, %s)
            ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password
        """, (username, hashed, role))
        print(f"  [+] {role} '{username}' upserted (password: {password})")
    conn.commit()
    cur.close()
    conn.close()
    print("\nDone! You can now log in with the credentials above.")

if __name__ == "__main__":
    main()
