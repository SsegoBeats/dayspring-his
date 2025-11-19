-- Migration: Add next of kin fields and enhance triage/OPD workflow
-- Date: 2024
-- Description: 
--  1. Adds next_of_kin_relation and next_of_kin_residence to patients table
--  2. Creates triage_assessments table if it doesn't exist (with metadata column for enhanced triage data)
--  3. Updates triage_category constraints to include all categories
--  4. Removes current_status constraint to support workflow statuses (triage, consultation, treatment, discharged)

-- Add next of kin fields to patients table
DO $$
BEGIN
    -- Add next_of_kin_relation if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'next_of_kin_relation'
    ) THEN
        ALTER TABLE patients ADD COLUMN next_of_kin_relation VARCHAR(100);
    END IF;

    -- Add next_of_kin_residence if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'next_of_kin_residence'
    ) THEN
        ALTER TABLE patients ADD COLUMN next_of_kin_residence TEXT;
    END IF;
END $$;

-- Create triage_assessments table if it doesn't exist
CREATE TABLE IF NOT EXISTS triage_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode VARCHAR(10) CHECK (mode IN ('Adult', 'Child')),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature DECIMAL(4,1),
    oxygen_saturation INTEGER,
    avpu VARCHAR(1) CHECK (avpu IN ('A', 'V', 'P', 'U')),
    mobility VARCHAR(50),
    chief_complaint TEXT NOT NULL,
    discriminators JSONB DEFAULT '[]'::jsonb,
    category VARCHAR(20) CHECK (category IN ('Emergency', 'Very Urgent', 'Urgent', 'Routine', 'Standard', 'Non-urgent')),
    metadata JSONB
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_triage_assessments_patient_id ON triage_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_assessments_recorded_at ON triage_assessments(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_assessments_category ON triage_assessments(category);

-- Update triage_category enum to include all categories
DO $$
BEGIN
    -- First, drop the constraint if it exists
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_triage_category_check;
    
    -- Add the new constraint with all categories
    ALTER TABLE patients ADD CONSTRAINT patients_triage_category_check 
        CHECK (triage_category IS NULL OR triage_category IN ('Emergency', 'Very Urgent', 'Urgent', 'Routine', 'Standard', 'Non-urgent'));
END $$;

-- Update current_status to support workflow statuses if needed
DO $$
BEGIN
    -- Remove old constraint if exists
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_current_status_check;
    
    -- Note: If current_status needs specific values, add a CHECK constraint here
    -- For now, we'll keep it flexible as VARCHAR(50)
END $$;

-- Update triage_assessments category constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'triage_assessments' AND column_name = 'category'
    ) THEN
        ALTER TABLE triage_assessments DROP CONSTRAINT IF EXISTS triage_assessments_category_check;
        ALTER TABLE triage_assessments ADD CONSTRAINT triage_assessments_category_check 
            CHECK (category IN ('Emergency', 'Very Urgent', 'Urgent', 'Routine', 'Standard', 'Non-urgent'));
    END IF;
END $$;
