-- ============================================================
-- QR Code Based Mess Management System — Database Schema
-- Run this in your Supabase SQL Editor (or any PostgreSQL DB)
-- ============================================================

-- ── students ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    roll_no    VARCHAR(50)  UNIQUE NOT NULL,
    course     VARCHAR(20)  NOT NULL CHECK (course IN ('B.Tech', 'M.Tech', 'MCA', 'Diploma')),
    branch     VARCHAR(50),
    year       INT          NOT NULL CHECK (
        (course = 'B.Tech' AND year BETWEEN 1 AND 4) OR
        (course = 'M.Tech' AND year BETWEEN 1 AND 2) OR
        (course = 'MCA' AND year BETWEEN 1 AND 2) OR
        (course = 'Diploma' AND year BETWEEN 1 AND 3)
    ),
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ── users (admin / staff) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(50)  UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,   -- bcrypt hash
    role       VARCHAR(10)  NOT NULL CHECK (role IN ('admin','staff')),
    created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ── meal_slots ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_slots (
    id         SERIAL PRIMARY KEY,
    meal_type  VARCHAR(20)  UNIQUE NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')),
    start_time TIME         NOT NULL,
    end_time   TIME         NOT NULL,
    rate       NUMERIC(8,2) NOT NULL
);

-- ── meal_entry ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_entry (
    id              SERIAL PRIMARY KEY,
    student_id      INT          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    meal_type       VARCHAR(20)  NOT NULL,
    entry_time      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    entry_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
    recorded_by     INT          REFERENCES users(id),
    amount_deducted NUMERIC(8,2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_entry
    ON meal_entry (student_id, meal_type, entry_date);

-- ── billing_plans ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_plans (
    id                   SERIAL PRIMARY KEY,
    student_id           INT          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    installment_amount   NUMERIC(10,2) NOT NULL,
    balance              NUMERIC(10,2) NOT NULL,
    plan_start           DATE         NOT NULL,
    plan_end             DATE         NOT NULL,
    low_balance_threshold NUMERIC(8,2) NOT NULL DEFAULT 500,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- Only one active plan per student at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_plan
    ON billing_plans (student_id)
    WHERE is_active = TRUE;

-- ── billing_transactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_transactions (
    id               SERIAL PRIMARY KEY,
    billing_plan_id  INT          NOT NULL REFERENCES billing_plans(id),
    student_id       INT          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20)  NOT NULL CHECK (
        transaction_type IN ('deduction','installment','carry_forward','adjustment')
    ),
    amount           NUMERIC(10,2) NOT NULL,    -- negative for deductions
    balance_after    NUMERIC(10,2) NOT NULL,
    meal_entry_id    INT          REFERENCES meal_entry(id),
    note             VARCHAR(255),
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Seed Data ────────────────────────────────────────────────

-- Meal slots with rates
INSERT INTO meal_slots (meal_type, start_time, end_time, rate)
VALUES
    ('breakfast', '07:30', '09:30', 40),
    ('lunch',     '12:00', '14:00', 50),
    ('dinner',    '19:00', '21:00', 60)
ON CONFLICT (meal_type) DO NOTHING;

-- Default users
-- admin / admin@123  |  staff / staff@123
-- Hashes generated with bcrypt (cost=12)
INSERT INTO users (username, password, role)
VALUES
    ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeuQfpkNeKV8/fGS6', 'admin'),
    ('staff', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uJeu3/Yh2', 'staff')
ON CONFLICT (username) DO NOTHING;
-- NOTE: The hashes above are placeholders. Run init_users.py to regenerate them
--       with your chosen passwords (default: admin@123 / staff@123).
