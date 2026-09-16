// app/api/labor/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

const LABOR_SELECT = `
  SELECT
    lr.id,
    lr.patient_id,
    lr.midwife_id,
    lr.admission_date,
    lr.onset_of_labor,
    lr.delivery_date,
    lr.delivery_type,
    lr.duration_of_labor_hours,
    lr.presentation,
    lr.rupture_of_membranes,
    lr.placenta_delivery,
    lr.blood_loss_ml,
    lr.complications,
    lr.notes,
    lr.baby_sex,
    lr.baby_birth_weight_g,
    lr.baby_apgar_1min,
    lr.baby_apgar_5min,
    lr.baby_condition,
    lr.baby_notes,
    lr.created_at,
    lr.updated_at,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.patient_number,
    u.name AS midwife_name
  FROM labor_delivery_records lr
  JOIN patients p ON p.id = lr.patient_id
  LEFT JOIN users u ON u.id = lr.midwife_id`

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")?.trim() || null
    const fromParam = url.searchParams.get("from")?.trim() || null
    const toParam = url.searchParams.get("to")?.trim() || null

    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }

    const conditions: string[] = []
    const values: unknown[] = []

    if (patientId) {
      values.push(patientId)
      conditions.push(`lr.patient_id = $${values.length}`)
    }
    if (fromParam && toParam) {
      values.push(new Date(fromParam).toISOString())
      values.push(new Date(toParam).toISOString())
      conditions.push(`lr.admission_date >= $${values.length - 1}::timestamp AND lr.admission_date <= $${values.length}::timestamp`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `${LABOR_SELECT} ${where} ORDER BY lr.admission_date DESC LIMIT 200`,
      values,
    )

    return NextResponse.json({ records: rows })
  } catch (err) {
    console.error("GET /api/labor error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
      admissionDate?: string
      onsetOfLabor?: string
      deliveryDate?: string
      deliveryType?: string
      durationOfLaborHours?: unknown
      presentation?: string
      ruptureOfMembranes?: string
      placentaDelivery?: string
      bloodLossMl?: unknown
      complications?: string
      notes?: string
      babySex?: string
      babyBirthWeightG?: unknown
      babyApgar1min?: unknown
      babyApgar5min?: unknown
      babyCondition?: string
      babyNotes?: string
    }

    const patientId = (body.patientId ?? "").trim()
    if (!patientId || !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    const admissionDate = body.admissionDate || new Date().toISOString()
    if (Number.isNaN(new Date(admissionDate).getTime())) {
      return NextResponse.json({ error: "admissionDate is not a valid date" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO labor_delivery_records
         (patient_id, midwife_id, admission_date, onset_of_labor, delivery_date,
          delivery_type, duration_of_labor_hours, presentation, rupture_of_membranes,
          placenta_delivery, blood_loss_ml, complications, notes,
          baby_sex, baby_birth_weight_g, baby_apgar_1min, baby_apgar_5min,
          baby_condition, baby_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        patientId,
        auth.userId,
        admissionDate,
        body.onsetOfLabor ?? null,
        body.deliveryDate ?? null,
        body.deliveryType ?? null,
        toFloat(body.durationOfLaborHours),
        body.presentation ?? null,
        body.ruptureOfMembranes ?? null,
        body.placentaDelivery ?? null,
        toInt(body.bloodLossMl),
        body.complications ?? null,
        body.notes ?? null,
        body.babySex ?? null,
        toInt(body.babyBirthWeightG),
        toInt(body.babyApgar1min),
        toInt(body.babyApgar5min),
        body.babyCondition ?? null,
        body.babyNotes ?? null,
      ],
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/labor error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
