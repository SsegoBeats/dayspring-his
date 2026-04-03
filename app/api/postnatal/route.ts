// app/api/postnatal/route.ts
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

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")?.trim() || null
    const laborId = url.searchParams.get("laborId")?.trim() || null

    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    if (laborId && !UUID_RE.test(laborId)) {
      return NextResponse.json({ error: "laborId must be a valid UUID" }, { status: 400 })
    }

    const conditions: string[] = []
    const values: unknown[] = []
    if (patientId) { values.push(patientId); conditions.push(`pv.patient_id = $${values.length}`) }
    if (laborId) { values.push(laborId); conditions.push(`pv.labor_delivery_id = $${values.length}`) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT
         pv.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.patient_number,
         u.name AS midwife_name
       FROM postnatal_visits pv
       JOIN patients p ON p.id = pv.patient_id
       LEFT JOIN users u ON u.id = pv.midwife_id
       ${where}
       ORDER BY pv.visit_date DESC LIMIT 200`,
      values,
    )
    return NextResponse.json({ visits: rows })
  } catch (err) {
    console.error("GET /api/postnatal error:", err)
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
      laborDeliveryId?: string
      visitDate?: string
      daysPostpartum?: unknown
      bpSystolic?: unknown
      bpDiastolic?: unknown
      temperatureC?: unknown
      lochia?: string
      woundHealing?: string
      breastfeedingStatus?: string
      babyWeightG?: unknown
      babyCondition?: string
      notes?: string
    }

    const patientId = (body.patientId ?? "").trim()
    if (!patientId || !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    const visitDate = body.visitDate || new Date().toISOString()
    if (Number.isNaN(new Date(visitDate).getTime())) {
      return NextResponse.json({ error: "visitDate is not a valid date" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO postnatal_visits
         (patient_id, labor_delivery_id, midwife_id, visit_date, days_postpartum,
          bp_systolic, bp_diastolic, temperature_c, lochia, wound_healing,
          breastfeeding_status, baby_weight_g, baby_condition, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        patientId,
        body.laborDeliveryId && UUID_RE.test(body.laborDeliveryId) ? body.laborDeliveryId : null,
        auth.userId,
        visitDate,
        toInt(body.daysPostpartum),
        toInt(body.bpSystolic),
        toInt(body.bpDiastolic),
        toFloat(body.temperatureC),
        body.lochia ?? null,
        body.woundHealing ?? null,
        body.breastfeedingStatus ?? null,
        toInt(body.babyWeightG),
        body.babyCondition ?? null,
        body.notes ?? null,
      ],
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/postnatal error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
