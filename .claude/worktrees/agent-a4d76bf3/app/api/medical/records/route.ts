import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

function parseBloodPressure(bp: unknown): { sys: number | null; dia: number | null } {
  if (!bp) return { sys: null, dia: null }
  const s = String(bp)
  const parts = s.split(/[/\-\s]+/)
  if (parts.length >= 2) {
    const sys = toInt(parts[0])
    const dia = toInt(parts[1])
    return { sys, dia }
  }
  const nums = s.match(/\d+/g)
  if (nums && nums.length >= 2) return { sys: toInt(nums[0]), dia: toInt(nums[1]) }
  return { sys: toInt(bp), dia: null }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      chiefComplaint?: string
      diagnosis?: string
      treatmentPlan?: string
      notes?: string
      vitalSigns?: {
        bloodPressure?: string
        temperature?: string
        heartRate?: string
        respiratoryRate?: string
        oxygenSaturation?: string
      }
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const chiefComplaint = body.chiefComplaint || null
    const diagnosis = body.diagnosis || null
    const treatmentPlan = body.treatmentPlan || null
    const notes = body.notes || null

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO medical_records (
         patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes
       ) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, patient_id, doctor_id, visit_date, chief_complaint, diagnosis, treatment_plan, notes`,
      [patientId, auth.userId, chiefComplaint, diagnosis, treatmentPlan, notes],
    )

    const record = rows[0]
    const vitalSigns = body.vitalSigns

    if (record?.id && vitalSigns && typeof vitalSigns === "object") {
      const { sys, dia } = parseBloodPressure(vitalSigns.bloodPressure)
      const temperature = toFloat(vitalSigns.temperature)
      const heartRate = toInt(vitalSigns.heartRate)
      const respiratoryRate = toInt(vitalSigns.respiratoryRate)
      const oxygenSaturation = toInt(vitalSigns.oxygenSaturation)
      if (sys !== null || dia !== null || temperature !== null || heartRate !== null || respiratoryRate !== null || oxygenSaturation !== null) {
        try {
          await queryWithSession(
            { role: auth.role, userId: auth.userId },
            `INSERT INTO vital_signs (
               patient_id, nurse_id, medical_record_id, blood_pressure_systolic, blood_pressure_diastolic,
               heart_rate, temperature, respiratory_rate, oxygen_saturation
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              patientId,
              auth.userId,
              record.id,
              sys,
              dia,
              heartRate,
              temperature,
              respiratoryRate,
              oxygenSaturation,
            ],
          )
        } catch {
          // Non-fatal: record already saved; vitals can be re-entered
        }
      }
    }

    return NextResponse.json({ record })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create medical record" }, { status: 500 })
  }
}

