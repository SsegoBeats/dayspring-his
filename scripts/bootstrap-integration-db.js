// Lightweight bootstrap for local integration runs.
// Ensures only the core tables/columns used by auth, medical persistence, and referrals tests.
const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return
  const dotenv = require("dotenv")
  const parsed = dotenv.parse(fs.readFileSync(filePath))
  for (const key of Object.keys(parsed)) {
    if (!process.env[key]) process.env[key] = parsed[key]
  }
}

function loadEnv() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")
}

async function main() {
  loadEnv()

  const connectionString = process.env.INTEGRATION_DATABASE_URL
  if (!connectionString) {
    console.error("INTEGRATION_DATABASE_URL is not set. Refusing to modify a non-integration database.")
    process.exit(2)
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  })

  await client.connect()

  try {
    await client.query("BEGIN")

    await client.query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT,
        facility_id UUID,
        is_active BOOLEAN NOT NULL DEFAULT true,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        email_verified_at TIMESTAMPTZ,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS facility_id UUID`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email))`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_number TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        gender TEXT,
        facility_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS facility_id UUID`)
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    await client.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        chief_complaint TEXT,
        history TEXT,
        impression TEXT,
        diagnosis TEXT,
        treatment_plan TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS history TEXT`)
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS impression TEXT`)
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS notes TEXT`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_medical_records_patient_visit ON medical_records(patient_id, visit_date DESC)`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS vital_signs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        nurse_id UUID REFERENCES users(id) ON DELETE SET NULL,
        medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
        blood_pressure_systolic INTEGER,
        blood_pressure_diastolic INTEGER,
        heart_rate INTEGER,
        temperature NUMERIC(5, 2),
        respiratory_rate INTEGER,
        oxygen_saturation INTEGER,
        notes TEXT,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS notes TEXT`)
    await client.query(`ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vital_signs_record ON vital_signs(medical_record_id, recorded_at DESC)`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('internal', 'external-out', 'external-in')),
        referring_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        referring_role TEXT,
        facility_id UUID,
        receiving_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        receiving_department TEXT,
        external_facility_name TEXT,
        external_clinician_name TEXT,
        external_clinician_contact TEXT,
        reason TEXT NOT NULL,
        urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('emergency', 'Very Urgent', 'urgent', 'routine', 'low')),
        notes TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
        handoff_snapshot JSONB,
        accepted_at TIMESTAMPTZ,
        accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        completed_at TIMESTAMPTZ,
        completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS facility_id UUID`)
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS handoff_snapshot JSONB`)
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`)
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`)
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_referrals_patient_created ON referrals(patient_id, created_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_referrals_status_urgency ON referrals(status, urgency)`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id BIGSERIAL PRIMARY KEY,
        key TEXT NOT NULL,
        window_seconds INTEGER NOT NULL,
        window_start TIMESTAMP NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key)`)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_window_unique
      ON rate_limits(key, window_seconds, window_start)
    `)

    await client.query("COMMIT")
    console.log("OK: integration bootstrap schema is ready")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err.message || err)
  process.exit(1)
})
