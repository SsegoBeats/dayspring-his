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

function normalizeUuid(value: unknown): string | null {
  if (!value) return null
  const v = String(value).trim()
  return UUID_RE.test(v) ? v : null
}

function isOptionalPositiveInteger(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true
  if (typeof value !== "number" && typeof value !== "string") return false
  const number = Number(value)
  return Number.isInteger(number) && number > 0
}

function isOptionalPositiveNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true
  if (typeof value !== "number" && typeof value !== "string") return false
  const number = Number(value)
  return Number.isFinite(number) && number > 0
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
    const from = url.searchParams.get("from")?.trim() || null
    const to = url.searchParams.get("to")?.trim() || null

    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    if (laborId && !UUID_RE.test(laborId)) {
      return NextResponse.json({ error: "laborId must be a valid UUID" }, { status: 400 })
    }
    if (from && Number.isNaN(new Date(from).getTime())) {
      return NextResponse.json({ error: "from must be a valid datetime" }, { status: 400 })
    }
    if (to && Number.isNaN(new Date(to).getTime())) {
      return NextResponse.json({ error: "to must be a valid datetime" }, { status: 400 })
    }

    const conditions: string[] = []
    const values: unknown[] = []
    if (patientId) { values.push(patientId); conditions.push(`pv.patient_id = $${values.length}`) }
    if (laborId) { values.push(laborId); conditions.push(`pv.labor_delivery_id = $${values.length}`) }
    if (from) { values.push(from); conditions.push(`pv.visit_date >= $${values.length}`) }
    if (to) { values.push(to); conditions.push(`pv.visit_date <= $${values.length}`) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT
         pv.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.patient_number,
         np.patient_number AS newborn_patient_number,
         CONCAT(np.first_name, ' ', np.last_name) AS newborn_patient_name,
         u.name AS midwife_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', lt.id,
             'test_name', lt.test_name,
             'status', lt.status,
             'ordered_at', lt.ordered_at
           ) ORDER BY lt.ordered_at)
           FROM lab_tests lt
           WHERE lt.postnatal_visit_id = pv.id
         ), '[]'::json) AS lab_investigations
       FROM postnatal_visits pv
       JOIN patients p ON p.id = pv.patient_id
       LEFT JOIN patients np ON np.id = pv.newborn_id
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
      nutritionAssessment?: string
      motherNutritionStatus?: string
      newbornId?: string
      newbornFeedingStatus?: string
      cordStatus?: string
      maternalDangerSigns?: unknown
      newbornDangerSigns?: unknown
      notes?: string
      generalAssessment?: string
      pulseRate?: unknown
      respiratoryRate?: unknown
      weightKg?: unknown
      otherObservations?: string
      nutritionIntake?: string
      nutritionFoodAccess?: string
      nutritionSupplements?: string
      nutritionCounselling?: string
      cordAssessment?: string
      cordCareProvided?: string
      cordAdvice?: string
      cordConcerns?: string
      cordFollowUp?: string
    }

    const patientId = (body.patientId ?? "").trim()
    if (!patientId || !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    const visitDate = body.visitDate || new Date().toISOString()
    if (Number.isNaN(new Date(visitDate).getTime())) {
      return NextResponse.json({ error: "visitDate is not a valid date" }, { status: 400 })
    }
    if (!isOptionalPositiveInteger(body.pulseRate) || !isOptionalPositiveInteger(body.respiratoryRate)) {
      return NextResponse.json({ error: "Pulse and respiratory rate must be positive whole numbers" }, { status: 400 })
    }
    if (!isOptionalPositiveNumber(body.weightKg)) {
      return NextResponse.json({ error: "Weight must be a positive number" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO postnatal_visits
         (patient_id, labor_delivery_id, midwife_id, visit_date, days_postpartum,
          bp_systolic, bp_diastolic, temperature_c, lochia, wound_healing,
         breastfeeding_status, baby_weight_g, baby_condition,
         nutrition_assessment, mother_nutrition_status, newborn_id, newborn_feeding_status,
         cord_status, maternal_danger_signs, newborn_danger_signs, notes,
         general_assessment, pulse_rate, respiratory_rate, weight_kg, other_observations,
         nutrition_intake, nutrition_food_access, nutrition_supplements, nutrition_counselling,
         cord_assessment, cord_care_provided, cord_advice, cord_concerns, cord_follow_up)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21,
               $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
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
        body.nutritionAssessment ?? null,
        body.motherNutritionStatus ?? null,
        normalizeUuid(body.newbornId),
        body.newbornFeedingStatus ?? null,
        body.cordStatus ?? null,
        body.maternalDangerSigns ? JSON.stringify(body.maternalDangerSigns) : null,
        body.newbornDangerSigns ? JSON.stringify(body.newbornDangerSigns) : null,
        body.notes ?? null,
        body.generalAssessment ?? null,
        toInt(body.pulseRate),
        toInt(body.respiratoryRate),
        toFloat(body.weightKg),
        body.otherObservations ?? null,
        body.nutritionIntake ?? null,
        body.nutritionFoodAccess ?? null,
        body.nutritionSupplements ?? null,
        body.nutritionCounselling ?? null,
        body.cordAssessment ?? null,
        body.cordCareProvided ?? null,
        body.cordAdvice ?? null,
        body.cordConcerns ?? null,
        body.cordFollowUp ?? null,
      ],
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/postnatal error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
