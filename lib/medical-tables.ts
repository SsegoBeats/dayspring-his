/**
 * Ensures the patient_allergies, patient_immunizations, patient_chronic_conditions
 * and documents (file_name/notes columns) tables exist.
 * Called lazily from each API route so the app never hard-crashes due to a
 * missing migration run.
 */
import { query } from "@/lib/db"
import { DAYS_PER_BUCKET, TIMING_BUCKETS, VACCINES_BY_TIMING, type TimingBucket } from "@/lib/immunization-schedule"

let ensured = false

export async function ensureMedicalTables(): Promise<void> {
  if (ensured) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS patient_allergies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        allergen TEXT NOT NULL,
        reaction TEXT NOT NULL,
        severity VARCHAR(10) NOT NULL CHECK (severity IN ('mild','moderate','severe')),
        diagnosed_date DATE,
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id)`)

    await query(`
      CREATE TABLE IF NOT EXISTS patient_immunizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        vaccine_name TEXT NOT NULL,
        date_administered DATE NOT NULL,
        next_due_date DATE,
        overdue_date DATE,
        age_time TEXT,
        schedule_code TEXT,
        dose TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'Given' CHECK (status IN ('Due','Given','Overdue','Not Given','Contraindicated','Refused')),
        status_reason TEXT,
        administered_by TEXT,
        route TEXT,
        manufacturer TEXT,
        batch_number VARCHAR(100),
        is_other_vaccine BOOLEAN NOT NULL DEFAULT FALSE,
        other_vaccine_reason TEXT,
        contraindication_reason TEXT,
        refusal_reason TEXT,
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_patient_immunizations_patient ON patient_immunizations(patient_id)`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS overdue_date DATE`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS age_time TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS schedule_code TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS dose TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Given'`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS status_reason TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS route TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS manufacturer TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS is_other_vaccine BOOLEAN NOT NULL DEFAULT FALSE`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS other_vaccine_reason TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS contraindication_reason TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS refusal_reason TEXT`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS administered_at TIMESTAMP`)
    await query(`ALTER TABLE patient_immunizations ADD COLUMN IF NOT EXISTS administration_site TEXT`)
    await query(`ALTER TABLE patient_immunizations ALTER COLUMN date_administered DROP NOT NULL`)

    await query(`
      CREATE TABLE IF NOT EXISTS immunization_schedule_config (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        timing_bucket TEXT NOT NULL,
        day_offset INTEGER,
        vaccine_name TEXT,
        bucket_order INTEGER NOT NULL DEFAULT 0,
        vaccine_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_immunization_schedule_bucket ON immunization_schedule_config(timing_bucket, is_active)`)

    const { rows: scheduleRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM immunization_schedule_config`
    )
    const existingCount = Number(scheduleRows?.[0]?.count || "0")
    if (existingCount === 0) {
      let bucketOrder = 0
      for (const bucket of TIMING_BUCKETS) {
        const vaccines = VACCINES_BY_TIMING[bucket] || []
        const dayOffset = DAYS_PER_BUCKET[bucket]
        if (!vaccines.length) {
          await query(
            `INSERT INTO immunization_schedule_config (timing_bucket, day_offset, vaccine_name, bucket_order, vaccine_order, is_active)
             VALUES ($1, $2, NULL, $3, $4, TRUE)`,
            [bucket, dayOffset, bucketOrder, 0],
          )
          bucketOrder += 1
          continue
        }

        let vaccineOrder = 0
        for (const vaccineName of vaccines) {
          await query(
            `INSERT INTO immunization_schedule_config (timing_bucket, day_offset, vaccine_name, bucket_order, vaccine_order, is_active)
             VALUES ($1, $2, $3, $4, $5, TRUE)`,
            [bucket, dayOffset, vaccineName, bucketOrder, vaccineOrder],
          )
          vaccineOrder += 1
        }
        bucketOrder += 1
      }
    }

    await query(`
      CREATE TABLE IF NOT EXISTS patient_chronic_conditions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        condition TEXT NOT NULL,
        diagnosed_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','managed','resolved')),
        medications TEXT[],
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_patient_chronic_conditions_patient ON patient_chronic_conditions(patient_id)`)

    await query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT`)
    await query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT`)

    ensured = true
  } catch {
    // Best-effort — individual routes still handle errors gracefully
  }
}
