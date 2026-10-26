import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? Number.parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? Number.parseFloat(m[0]) : null
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const laborDeliveryId = url.searchParams.get("laborDeliveryId")?.trim() || null
    const patientId = url.searchParams.get("patientId")?.trim() || null

    if (laborDeliveryId && !UUID_RE.test(laborDeliveryId)) {
      return NextResponse.json({ error: "laborDeliveryId must be a valid UUID" }, { status: 400 })
    }
    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }

    const conditions: string[] = []
    const values: unknown[] = []

    if (laborDeliveryId) {
      values.push(laborDeliveryId)
      conditions.push(`lve.labor_delivery_id = $${values.length}`)
    }
    if (patientId) {
      values.push(patientId)
      conditions.push(`lve.patient_id = $${values.length}`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT
         lve.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.patient_number,
         u.name AS recorded_by_name
       FROM labor_vital_events lve
       JOIN patients p ON p.id = lve.patient_id
       LEFT JOIN users u ON u.id = lve.recorded_by
       ${where}
       ORDER BY lve.measured_at DESC
       LIMIT 300`,
      values,
    )

    return NextResponse.json({ events: rows })
  } catch (err) {
    console.error("GET /api/labor/vitals error:", err)
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
      laborDeliveryId?: string
      patientId?: string
      measuredAt?: string
      bpSystolic?: unknown
      bpDiastolic?: unknown
      pulseRate?: unknown
      respiratoryRate?: unknown
      temperatureC?: unknown
      fetalHeartRate?: unknown
      contractionsPer10min?: unknown
      cervicalDilationCm?: unknown
      oxygenSaturation?: unknown
      urineOutputMl?: unknown
      maternalWeightKg?: unknown
      notes?: string
    }

    const laborDeliveryId = (body.laborDeliveryId ?? "").trim()
    const patientId = (body.patientId ?? "").trim()

    if (!laborDeliveryId || !UUID_RE.test(laborDeliveryId)) {
      return NextResponse.json({ error: "laborDeliveryId must be a valid UUID" }, { status: 400 })
    }
    if (!patientId || !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }

    const measuredAt = body.measuredAt || new Date().toISOString()
    if (Number.isNaN(new Date(measuredAt).getTime())) {
      return NextResponse.json({ error: "measuredAt is not a valid date" }, { status: 400 })
    }

    const { rows } = await queryWithSession<{ id: string }>(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO labor_vital_events (
         labor_delivery_id,
         patient_id,
         recorded_by,
         measured_at,
         bp_systolic,
         bp_diastolic,
         pulse_rate,
         respiratory_rate,
         temperature_c,
         fetal_heart_rate,
         contractions_per_10min,
         cervical_dilation_cm,
         oxygen_saturation,
         urine_output_ml,
         maternal_weight_kg,
         notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        laborDeliveryId,
        patientId,
        auth.userId,
        measuredAt,
        toInt(body.bpSystolic),
        toInt(body.bpDiastolic),
        toInt(body.pulseRate),
        toInt(body.respiratoryRate),
        toFloat(body.temperatureC),
        toInt(body.fetalHeartRate),
        toInt(body.contractionsPer10min),
        toFloat(body.cervicalDilationCm),
        toInt(body.oxygenSaturation),
        toInt(body.urineOutputMl),
        toFloat(body.maternalWeightKg),
        body.notes ?? null,
      ],
    )

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auth.userId,
        "LABOR_VITAL_EVENT_CREATED",
        "LaborVitalEvent",
        rows[0].id,
        JSON.stringify({ laborDeliveryId, patientId, measuredAt }),
      ],
    )

    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (err) {
    console.error("POST /api/labor/vitals error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
