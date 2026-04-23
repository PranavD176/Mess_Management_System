# QR Code Based Mess Management System

A full-stack web application for college mess management using QR codes, FastAPI, React, and Supabase.

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Supabase project (free tier works)

---

## 1. Database Setup

1. Go to your **Supabase Dashboard → SQL Editor**
2. Run the contents of `db/schema.sql`
3. Your tables and seed data (meal slots) are now created

If you already have existing data created with decimal amounts, run this one-time migration after schema updates:

4. Run `backend/db/convert_money_columns_to_integer.sql` to convert existing money values to integer rupees

---

## 2. Backend Setup

```bash
cd backend

# Copy env template and fill in your values
copy .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://postgres.YOURREF:YOURPASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
JWT_SECRET=any_long_random_secret
```

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create default admin/staff users in DB
python init_users.py

# Start the API server
uvicorn main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

Default credentials (set by `init_users.py`):
- Admin: `admin` / `admin@123`
- Staff: `staff` / `staff@123`

---

## 3. Frontend Setup

```bash
cd frontend

# Install dependencies (already done if you ran npm install)
npm install

#if error then run:
npm install --legacy-peer-deps

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in Chrome (required for QR scanning via BarcodeDetector API).

---

## Project Structure

```
Mess_Management_System/
├── backend/
│   ├── main.py               # FastAPI app entry
│   ├── config.py             # Env var loading
│   ├── database.py           # psycopg2 connection pool
│   ├── auth.py               # JWT + bcrypt helpers
│   ├── init_users.py         # One-time user seeding script
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py           # POST /auth/login
│   │   ├── students.py       # Student CRUD + QR generation
│   │   ├── meals.py          # Scan + report endpoints
│   │   └── billing.py        # Plans, transactions, adjustments
│   └── services/
│       ├── qr_service.py     # QR PNG → base64
│       └── billing_service.py# Deduction, renew, carry-forward
│
├── frontend/
│   └── src/
│       ├── api/index.js      # Axios + all API calls
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   └── ProtectedRoute.jsx
│       └── pages/
│           ├── LoginPage.jsx
│           ├── ScanPage.jsx
│           ├── RegisterStudentPage.jsx
│           ├── StudentListPage.jsx
│           ├── StudentDetailPage.jsx
│           ├── CreatePlanPage.jsx
│           ├── ManualAdjustPage.jsx
│           ├── DailyReportPage.jsx
│           ├── MonthlyReportPage.jsx
│           └── BillingReportPage.jsx
│
└── db/
    └── schema.sql            # Full DDL + seed data
```

---

## Features

| Feature | Details |
|---|---|
| **QR Scan** | Camera-based (BarcodeDetector API) + manual ID fallback |
| **Meal Slots** | Breakfast ₹40, Lunch ₹50, Dinner ₹60 — time-gated |
| **Duplicate prevention** | DB-level UNIQUE constraint on (student, meal, date) |
| **Billing** | Prepaid balance, real-time deduction on every scan |
| **Low balance warning** | Configurable threshold (default ₹500) |
| **Carry-forward** | Remaining balance added to next plan automatically |
| **Reports** | Daily, monthly, billing report with color indicators |
| **Roles** | Admin (full access) and Staff (scan + balance only) |

---

## API Reference

Full interactive docs: **http://localhost:8000/docs**

| Endpoint | Method | Role |
|---|---|---|
| `/auth/login` | POST | Public |
| `/students` | GET, POST | Admin |
| `/students/{id}` | GET | Admin |
| `/meals/scan` | POST | Staff/Admin |
| `/meals/report/daily` | GET | Admin |
| `/meals/report/monthly` | GET | Admin |
| `/meals/history/{id}` | GET | Admin |
| `/billing/plans` | POST | Admin |
| `/billing/plans/{id}/renew` | POST | Admin |
| `/billing/report` | GET | Admin |
| `/billing/adjust` | POST | Admin |
| `/billing/balance/{id}` | GET | Staff/Admin |

---

## Notes

- **QR Scanning** requires Chrome 88+ (for BarcodeDetector API) on localhost
- All amounts are in Indian Rupees (₹)
- Money values are stored and shown as integer rupees (no decimals)
- No student-facing login — only admin and staff accounts
- Runs on localhost only — no deployment needed for college use
