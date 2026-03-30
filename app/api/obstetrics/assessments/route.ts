// app/api/obstetrics/assessments/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, patient_id, visit_date, gravida, parity,
              gestational_age_weeks, edd, fundal_height_cm,
              fetal_heart_rate, presentation, notes, created_at
       FROM obstetric_assessments
       WHERE patient_id = $1
       ORDER BY visit_date DESC`,
      [patientId],
    )

    return NextResponse.json({ assessments: rows })
  } catch (err) {
    console.error("GET /api/obstetrics/assessments error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      visitDate?: string
      gravida?: number
      parity?: number
      gestationalAgeWeeks?: number
      edd?: string
      fundalHeightCm?: number
      fetalHeartRate?: number
      presentation?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    const visitDate = body.visitDate || new Date().toISOString()

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO obstetric_assessments
         (patient_id, recorded_by, visit_date, gravida, parity,
          gestational_age_weeks, edd, fundal_height_cm,
          fetal_heart_rate, presentation, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, patient_id, visit_date, gravida, parity,
                 gestational_age_weeks, edd, fundal_height_cm,
                 fetal_heart_rate, presentation, notes, created_at`,
      [
        patientId,
        auth.userId,
        visitDate,
        body.gravida ?? null,
        body.parity ?? null,
        body.gestationalAgeWeeks ?? null,
        body.edd ?? null,
        body.fundalHeightCm ?? null,
        body.fetalHeartRate ?? null,
        body.presentation ?? null,
        body.notes ?? null,
      ],
    )

    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/obstetrics/assessments error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
