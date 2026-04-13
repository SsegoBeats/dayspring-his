// Quick DB checker for receptionist portal dependencies
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
  if (!cs) {
    console.error('DATABASE_URL not set. Please configure your .env file.')
    process.exit(2)
  }
  const client = new Client({ connectionString: cs, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false })
  await client.connect()
  const q = (sql, params) => client.query(sql, params)

  const required = {
    patients: ['id','patient_number','first_name','last_name','date_of_birth','age_years','gender','phone','email','address','nin','district','subcounty','parish','village','occupation','next_of_kin_name','next_of_kin_phone','emergency_contact_name','emergency_contact_phone','blood_group','allergies','current_status','created_at','updated_at','next_of_kin_first_name','next_of_kin_last_name','next_of_kin_country','next_of_kin_relation','next_of_kin_residence','insurance_provider','insurance_member_no'],
    triage_assessments: ['id','patient_id','category','chief_complaint','temperature','heart_rate','blood_pressure_systolic','blood_pressure_diastolic','respiratory_rate','oxygen_saturation','avpu','mode','mobility','metadata','recorded_at','created_at'],
    appointments: ['id','patient_id','doctor_id','appointment_date','appointment_time','department','status','notes','created_at'],
    users: ['id','email','password_hash','name','role','department','is_active','created_at','updated_at'],
    notifications: ['id','user_id','department','role','title','message','payload','read_at','created_at'],
    patient_deletion_requests: ['id','patient_id','reason','status','requested_by','approved_by','approved_at','created_at'],
    audit_logs: ['id','user_id','action','entity_type','entity_id','details','created_at'],
  }

  const results = {}
  for (const t of Object.keys(required)) {
    const colsRes = await q(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [t])
    const cols = new Set(colsRes.rows.map(r => r.column_name))
    const missing = required[t].filter(c => !cols.has(c))
    results[t] = { present: colsRes.rows.length > 0, missing }
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2))
  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })

