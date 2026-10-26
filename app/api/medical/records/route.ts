import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"

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

function mapRecordRow(row: any) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name || "",
    patientName: row.patient_name || "",
    visitDate: row.visit_date,
    chiefComplaint: row.chief_complaint || "",
    history: row.history || "",
    impression: row.impression || "",
    diagnosis: row.diagnosis || "",
    treatmentPlan: row.treatment_plan || "",
    notes: row.notes || "",
    vitalSigns:
      row.blood_pressure_systolic != null ||
      row.blood_pressure_diastolic != null ||
      row.temperature != null ||
      row.heart_rate != null ||
      row.respiratory_rate != null ||
      row.oxygen_saturation != null
        ? {
            bloodPressure:
              row.blood_pressure_systolic != null && row.blood_pressure_diastolic != null
                ? `${row.blood_pressure_systolic}/${row.blood_pressure_diastolic}`
                : undefined,
            temperature: row.temperature != null ? String(row.temperature) : undefined,
            heartRate: row.heart_rate != null ? String(row.heart_rate) : undefined,
            respiratoryRate: row.respiratory_rate != null ? String(row.respiratory_rate) : undefined,
            oxygenSaturation: row.oxygen_saturation != null ? String(row.oxygen_saturation) : undefined,
          }
        : undefined,
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = (url.searchParams.get("patientId") || "").trim()
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)))
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT mr.id, mr.patient_id, mr.doctor_id, mr.visit_date, mr.chief_complaint, mr.history, mr.impression,
              mr.diagnosis, mr.treatment_plan, mr.notes,
              u.name AS doctor_name,
              TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
              vs.blood_pressure_systolic, vs.blood_pressure_diastolic, vs.heart_rate, vs.temperature,
              vs.respiratory_rate, vs.oxygen_saturation
         FROM medical_records mr
         LEFT JOIN users u ON u.id = mr.doctor_id
         LEFT JOIN patients p ON p.id = mr.patient_id
         LEFT JOIN LATERAL (
           SELECT blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature,
                  respiratory_rate, oxygen_saturation
           FROM vital_signs
           WHERE vital_signs.medical_record_id = mr.id
           ORDER BY recorded_at DESC NULLS LAST
           LIMIT 1
         ) vs ON true
        WHERE mr.patient_id = $1
        ORDER BY mr.visit_date DESC
        LIMIT $2`,
      [patientId, limit],
    )

    return NextResponse.json({ records: rows.map(mapRecordRow) })
  } catch {
    return NextResponse.json({ error: "Failed to fetch medical records" }, { status: 500 })
  }
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
      history?: string
      impression?: string
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
    const history = body.history || null
    const impression = body.impression || null
    const diagnosis = body.diagnosis || null
    const treatmentPlan = body.treatmentPlan || null
    const notes = body.notes || null

    const record = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO medical_records (
           patient_id, doctor_id, chief_complaint, history, impression, diagnosis, treatment_plan, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, patient_id, doctor_id, visit_date, chief_complaint, history, impression, diagnosis, treatment_plan, notes`,
        [patientId, auth.userId, chiefComplaint, history, impression, diagnosis, treatmentPlan, notes],
      )

      const inserted = rows[0]
      const vitalSigns = body.vitalSigns
      if (inserted?.id && vitalSigns && typeof vitalSigns === "object") {
        const { sys, dia } = parseBloodPressure(vitalSigns.bloodPressure)
        const temperature = toFloat(vitalSigns.temperature)
        const heartRate = toInt(vitalSigns.heartRate)
        const respiratoryRate = toInt(vitalSigns.respiratoryRate)
        const oxygenSaturation = toInt(vitalSigns.oxygenSaturation)
        if (sys !== null || dia !== null || temperature !== null || heartRate !== null || respiratoryRate !== null || oxygenSaturation !== null) {
          await client.query(
            `INSERT INTO vital_signs (
               patient_id, nurse_id, medical_record_id, blood_pressure_systolic, blood_pressure_diastolic,
               heart_rate, temperature, respiratory_rate, oxygen_saturation
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              patientId,
              auth.userId,
              inserted.id,
              sys,
              dia,
              heartRate,
              temperature,
              respiratoryRate,
              oxygenSaturation,
            ],
          )
        }
      }

      return inserted
    })

    return NextResponse.json({ record: mapRecordRow(record) })
  } catch {
    return NextResponse.json({ error: "Failed to create medical record" }, { status: 500 })
  }
}

