import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const CreateSchema = z.object({
  patientId: z.string().min(1),
  gravida: z.number().int().nonnegative().optional().nullable(),
  parity: z.number().int().nonnegative().optional().nullable(),
  gestationalAgeWeeks: z.number().int().nonnegative().optional().nullable(),
  edd: z.string().min(1).optional().nullable(),
  fundalHeightCm: z.number().nonnegative().optional().nullable(),
  fetalHeartRate: z.number().int().nonnegative().optional().nullable(),
  presentation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const patientId = (url.searchParams.get("patientId") || "").trim()
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT id,
            patient_id,
            recorded_by,
            visit_date,
            gravida,
            parity,
            gestational_age_weeks,
            edd,
            fundal_height_cm,
            fetal_heart_rate,
            presentation,
            notes
       FROM obstetric_assessments
      WHERE patient_id = $1
      ORDER BY visit_date DESC
      LIMIT 100`,
    [patientId],
  )

  return NextResponse.json({ assessments: rows })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const input = CreateSchema.parse(body)

    const edd = input.edd ? new Date(input.edd) : null

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO obstetric_assessments (
         patient_id,
         recorded_by,
         gravida,
         parity,
         gestational_age_weeks,
         edd,
         fundal_height_cm,
         fetal_heart_rate,
         presentation,
         notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,
                 patient_id,
                 recorded_by,
                 visit_date,
                 gravida,
                 parity,
                 gestational_age_weeks,
                 edd,
                 fundal_height_cm,
                 fetal_heart_rate,
                 presentation,
                 notes`,
      [
        input.patientId,
        auth.userId,
        input.gravida ?? null,
        input.parity ?? null,
        input.gestationalAgeWeeks ?? null,
        edd ? edd.toISOString().slice(0, 10) : null,
        input.fundalHeightCm ?? null,
        input.fetalHeartRate ?? null,
        input.presentation ?? null,
        input.notes ?? null,
      ],
    )

    return NextResponse.json({ assessment: rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create obstetric assessment" }, { status: 500 })
  }
}

