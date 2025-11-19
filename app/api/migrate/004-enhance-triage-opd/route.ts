import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST() {
  try {
    console.log("[Migration 004] Starting migration: enhance-triage-opd...")

    // Add missing columns to patients table
    await query(`
      DO $$
      BEGIN
          -- Add nin column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'nin'
          ) THEN
              ALTER TABLE patients ADD COLUMN nin VARCHAR(20);
          END IF;

          -- Add district column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'district'
          ) THEN
              ALTER TABLE patients ADD COLUMN district VARCHAR(100);
          END IF;

          -- Add subcounty column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'subcounty'
          ) THEN
              ALTER TABLE patients ADD COLUMN subcounty VARCHAR(100);
          END IF;

          -- Add parish column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'parish'
          ) THEN
              ALTER TABLE patients ADD COLUMN parish VARCHAR(100);
          END IF;

          -- Add village column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'village'
          ) THEN
              ALTER TABLE patients ADD COLUMN village VARCHAR(100);
          END IF;

          -- Add occupation column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'occupation'
          ) THEN
              ALTER TABLE patients ADD COLUMN occupation VARCHAR(100);
          END IF;

          -- Add insurance_provider column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'insurance_provider'
          ) THEN
              ALTER TABLE patients ADD COLUMN insurance_provider VARCHAR(100);
          END IF;

          -- Add insurance_member_no column if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'insurance_member_no'
          ) THEN
              ALTER TABLE patients ADD COLUMN insurance_member_no VARCHAR(100);
          END IF;

          -- Add next_of_kin_name if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'next_of_kin_name'
          ) THEN
              ALTER TABLE patients ADD COLUMN next_of_kin_name VARCHAR(255);
          END IF;

          -- Add next_of_kin_phone if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'next_of_kin_phone'
          ) THEN
              ALTER TABLE patients ADD COLUMN next_of_kin_phone VARCHAR(20);
          END IF;

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

          -- Add next_of_kin_first_name if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'next_of_kin_first_name'
          ) THEN
              ALTER TABLE patients ADD COLUMN next_of_kin_first_name VARCHAR(255);
          END IF;

          -- Add next_of_kin_last_name if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'next_of_kin_last_name'
          ) THEN
              ALTER TABLE patients ADD COLUMN next_of_kin_last_name VARCHAR(255);
          END IF;

          -- Add next_of_kin_country if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'patients' AND column_name = 'next_of_kin_country'
          ) THEN
              ALTER TABLE patients ADD COLUMN next_of_kin_country VARCHAR(100);
          END IF;
      END $$;
    `)

    // Add metadata column to triage_assessments if it doesn't exist
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'triage_assessments' AND column_name = 'metadata'
          ) THEN
              ALTER TABLE triage_assessments ADD COLUMN metadata JSONB;
          END IF;
          
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'triage_assessments' AND column_name = 'recorded_at'
          ) THEN
              ALTER TABLE triage_assessments ADD COLUMN recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
      END $$;
    `)

    // Create indexes if they don't exist
    await query(`
      CREATE INDEX IF NOT EXISTS idx_triage_assessments_patient_id ON triage_assessments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_triage_assessments_recorded_at ON triage_assessments(recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_triage_assessments_category ON triage_assessments(category);
    `)

    // Update triage_category constraint on patients table
    await query(`
      DO $$
      BEGIN
          ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_triage_category_check;
          ALTER TABLE patients ADD CONSTRAINT patients_triage_category_check 
              CHECK (triage_category IS NULL OR triage_category IN ('Emergency', 'Very Urgent', 'Urgent', 'Routine', 'Standard', 'Non-urgent'));
      END $$;
    `)

    // Update triage_assessments category constraint
    await query(`
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
    `)

    // Remove current_status constraint to support workflow statuses
    await query(`
      ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_current_status_check;
    `)

    console.log("[Migration 004] Migration completed successfully!")

    return NextResponse.json({
      success: true,
      message: "Migration 004 completed successfully! Added next_of_kin fields and enhanced triage/OPD workflow.",
    })
  } catch (error: any) {
    console.error("[Migration 004] Migration error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    )
  }
}