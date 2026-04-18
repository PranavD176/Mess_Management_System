-- Add approval status field to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Add index for faster queries on pending approvals
CREATE INDEX IF NOT EXISTS idx_students_approval ON students(is_approved);

-- Update existing students to be approved (for backward compatibility)
UPDATE students SET is_approved = TRUE WHERE is_approved IS NULL;
