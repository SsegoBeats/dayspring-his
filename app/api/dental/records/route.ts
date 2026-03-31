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
  toothNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const patientId = (url.searchParams.get("patientId") || "").trim() || null
  const mode = (url.searchParams.get("mode") || "").trim()
  const search = (url.searchParams.get("search") || "").trim() || null
  const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10) || 0)
  const PAGE_SIZE = 20

  // patientId is required UNLESS mode=mine is set
  if (!patientId && mode !== "mine") {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = { role: auth.role, userId: auth.userId }

  if (patientId) {
    // Original per-patient mode — unchanged behavior (no pagination, no search)
    const { rows } = await queryWithSession(
      session,
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

  // mode=mine: cross-patient history for the current dentist, with search + pagination
  const params: unknown[] = [auth.userId, PAGE_SIZE, page * PAGE_SIZE]
  const searchClause = search
    ? `AND (p.first_name ILIKE $4 OR p.last_name ILIKE $4 OR p.patient_number ILIKE $4
           OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $4)`
    : ""
  if (search) params.push(`%${search}%`)

  const { rows } = await queryWithSession(
    session,
    `SELECT dr.id,
            dr.patient_id,
            dr.dentist_id,
            dr.visit_date,
            dr.diagnosis,
            dr.procedure_performed,
            dr.tooth_chart,
            dr.notes,
            p.patient_number,
            p.first_name,
            p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
      WHERE dr.dentist_id = $1
        ${searchClause}
      ORDER BY dr.visit_date DESC
      LIMIT $2 OFFSET $3`,
    params,
  )

  // Total count for pagination metadata
  const countParams: unknown[] = [auth.userId]
  if (search) countParams.push(`%${search}%`)
  const { rows: countRows } = await queryWithSession(
    session,
    `SELECT COUNT(*) AS total
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
      WHERE dr.dentist_id = $1
        ${searchClause.replace(/\$4/g, `$2`)}`,
    countParams,
  )
  const total = parseInt(String(countRows[0]?.total ?? 0), 10)

  return NextResponse.json({
    records: rows,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  })
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
        input.toothNotes != null
          ? JSON.stringify({ ...(input.toothChart ?? {}), notes: input.toothNotes })
          : input.toothChart != null
            ? JSON.stringify(input.toothChart)
            : null,
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

