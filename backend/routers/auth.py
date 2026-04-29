"""
routers/auth.py — POST /auth/login
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_cursor
from auth import verify_password, create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    username_input = body.username.strip()
    if not username_input:
        raise HTTPException(status_code=400, detail="Username is required")

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, password, role FROM users WHERE LOWER(username) = LOWER(%s)",
            (username_input,),
        )
        user = cur.fetchone()

        if not user or not verify_password(body.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Check approval status for students
        if user["role"] == "student":
            cur.execute(
                "SELECT is_approved FROM students WHERE LOWER(roll_no) = LOWER(%s)",
                (user["username"],)
            )
            student = cur.fetchone()
            if not student or not student["is_approved"]:
                raise HTTPException(status_code=403, detail="Your registration is pending approval. Please contact admin.")

    token = create_access_token(
        {"sub": str(user["id"]), "role": user["role"], "username": user["username"]}
    )
    return {"success": True, "data": {"token": token, "role": user["role"], "username": user["username"]}}
