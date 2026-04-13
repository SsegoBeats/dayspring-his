/**
 * Ensures the patient_allergies, patient_immunizations, patient_chronic_conditions
 * and documents (file_name/notes columns) tables exist.
 * Called lazily from each API route so the app never hard-crashes due to a
 * missing migration run.
 */
import { query } from "@/lib/db"

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
        administered_by TEXT,
        batch_number VARCHAR(100),
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_patient_immunizations_patient ON patient_immunizations(patient_id)`)

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
