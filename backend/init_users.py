"""
init_users.py — Run once to generate proper bcrypt hashes for default accounts.
Credentials are loaded from users_credentials.json (never hardcoded here).
Usage: python init_users.py
"""
from passlib.context import CryptContext
import psycopg, os, json
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Load credentials from external JSON file (keep out of version control)
_creds_path = Path(__file__).resolve().parent / "users_credentials.json"
if not _creds_path.exists():
    raise FileNotFoundError(
        f"Credentials file not found: {_creds_path}\n"
        "Please create 'users_credentials.json' with username/password/role entries."
    )

with open(_creds_path, "r") as _f:
    _data = json.load(_f)

USERS = [(u["username"], u["password"], u["role"]) for u in _data]

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
