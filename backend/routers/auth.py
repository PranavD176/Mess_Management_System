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
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, password, role FROM users WHERE username = %s",
            (body.username,),
        )
        user = cur.fetchone()

    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(
        {"sub": str(user["id"]), "role": user["role"], "username": user["username"]}
    )
    return {"success": True, "data": {"token": token, "role": user["role"], "username": user["username"]}}
