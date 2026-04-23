-- Convert all money columns to integer rupees for existing data.
-- Run once on an existing database that previously used NUMERIC(x,2) values.

BEGIN;

ALTER TABLE meal_slots
    ALTER COLUMN rate TYPE INTEGER USING ROUND(rate)::INTEGER;

ALTER TABLE meal_entry
    ALTER COLUMN amount_deducted TYPE INTEGER USING ROUND(amount_deducted)::INTEGER;

ALTER TABLE billing_plans
    ALTER COLUMN installment_amount TYPE INTEGER USING ROUND(installment_amount)::INTEGER,
    ALTER COLUMN balance TYPE INTEGER USING ROUND(balance)::INTEGER,
    ALTER COLUMN low_balance_threshold TYPE INTEGER USING ROUND(low_balance_threshold)::INTEGER;

ALTER TABLE billing_transactions
    ALTER COLUMN amount TYPE INTEGER USING ROUND(amount)::INTEGER,
    ALTER COLUMN balance_after TYPE INTEGER USING ROUND(balance_after)::INTEGER;

-- Optional: convert pending plan amounts when the table exists.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pending_plans'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pending_plans' AND column_name = 'amount'
        ) THEN
            EXECUTE 'ALTER TABLE pending_plans ALTER COLUMN amount TYPE INTEGER USING ROUND(amount)::INTEGER';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pending_plans' AND column_name = 'low_balance_threshold'
        ) THEN
            EXECUTE 'ALTER TABLE pending_plans ALTER COLUMN low_balance_threshold TYPE INTEGER USING ROUND(low_balance_threshold)::INTEGER';
        END IF;
    END IF;
END $$;

COMMIT;
