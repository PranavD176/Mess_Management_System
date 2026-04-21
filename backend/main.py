"""
main.py — FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import auth, students, meals, billing

app = FastAPI(
    title="QR Mess Management System",
    description="Backend API for college mess management with QR scan & billing",
    version="1.0.0",
)

# Allow requests from the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(students.router, prefix="/students", tags=["Students"])
app.include_router(meals.router, prefix="/meals", tags=["Meals"])
app.include_router(billing.router, prefix="/billing", tags=["Billing"])

# Mount static files for uploaded PDFs
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/", tags=["Health"])
def health():
    return {"success": True, "data": {"status": "QR Mess API is running"}}
