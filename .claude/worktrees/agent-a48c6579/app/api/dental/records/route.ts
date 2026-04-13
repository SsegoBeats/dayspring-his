import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const CreateDentalSchema = z.object({
  patientId: z.string().min(1),
  diagnosis: z.string().optional().nullable(),
  procedurePerformed: z.string().optional().nullable(),
  toothChart: z.record(z.string(), z.any()).optional().nullable(),
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
            dentist_id,
            visit_date,
            diagnosis,
            procedure_performed,
            tooth_chart,
            notes
       FROM dental_records
      WHERE patient_id = $1
      ORDER BY visit_date DESC
      LIMIT 100`,
    [patientId],
  )

  return NextResponse.json({ records: rows })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const input = CreateDentalSchema.parse(body)

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO dental_records (
         patient_id,
         dentist_id,
         diagnosis,
         procedure_performed,
         tooth_chart,
         notes
       )
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,
                 patient_id,
                 dentist_id,
                 visit_date,
                 diagnosis,
                 procedure_performed,
                 tooth_chart,
                 notes`,
      [
        input.patientId,
        auth.userId,
        input.diagnosis ?? null,
        input.procedurePerformed ?? null,
        input.toothChart ?? null,
        input.notes ?? null,
      ],
    )

    return NextResponse.json({ record: rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create dental record" }, { status: 500 })
  }
}

