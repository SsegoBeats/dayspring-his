// Ensure required tables/columns exist for receptionist portal
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const dotenv = require('dotenv')
    const parsed = dotenv.parse(fs.readFileSync(envPath))
    for (const k of Object.keys(parsed)) {
      if (!process.env[k]) process.env[k] = parsed[k]
    }
  }
}

async function main() {
  loadEnv()
  const cs = process.env.DATABASE_URL
  if (!cs) throw new Error('DATABASE_URL not set')
  const client = new Client({ connectionString: cs, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false })
  await client.connect()
  const q = (sql, params) => client.query(sql, params)

  // Notifications: ensure table + payload column
  await q('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  await q(`CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100),
    role VARCHAR(50),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  const notifCols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='notifications'`)
  const hasPayload = new Set(notifCols.rows.map(r=>r.column_name)).has('payload')
  if (!hasPayload) {
    await q(`ALTER TABLE notifications ADD COLUMN payload JSONB`)  
  }
  await q(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`)
  await q(`CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC)`)
  await q(`CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC)`)

  // Patient deletion requests
  await q(`CREATE TABLE IF NOT EXISTS patient_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)

  console.log('DB fixed: notifications payload ensured; patient_deletion_requests ensured.')
  await client.end()
}

main().catch((e)=>{ console.error(e); process.exit(1) })

