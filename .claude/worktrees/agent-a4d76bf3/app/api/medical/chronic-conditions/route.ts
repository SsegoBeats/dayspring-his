import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { ensureMedicalTables } from "@/lib/medical-tables"

async function getAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  return auth
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureMedicalTables()

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get("patientId")

    const whereClause = patientId ? "WHERE pcc.patient_id = $1" : ""
    const params = patientId ? [patientId] : []

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT pcc.id, pcc.patient_id, pcc.condition, pcc.diagnosed_date,
              pcc.status, pcc.medications, pcc.notes, pcc.created_at, pcc.updated_at
       FROM patient_chronic_conditions pcc
       ${whereClause}
       ORDER BY pcc.diagnosed_date DESC NULLS LAST, pcc.created_at DESC`,
      params,
    )

    return NextResponse.json({ chronicConditions: rows })
  } catch (err: any) {
    if (err?.code === "42P01") return NextResponse.json({ chronicConditions: [] })
    console.error("Error fetching chronic conditions:", err)
    return NextResponse.json({ error: "Failed to fetch chronic conditions" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureMedicalTables()

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      condition?: string
      diagnosedDate?: string
      status?: string
      medications?: string[]
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    const condition = (body.condition || "").trim()
    const status = (body.status || "active").trim()

    if (!patientId || !condition) {
      return NextResponse.json({ error: "patientId and condition are required" }, { status: 400 })
    }

    if (!["active", "managed", "resolved"].includes(status)) {
      return NextResponse.json({ error: "status must be active, managed, or resolved" }, { status: 400 })
    }

    const medications = Array.isArray(body.medications) ? body.medications.filter(Boolean) : []

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO patient_chronic_conditions (patient_id, condition, diagnosed_date, status, medications, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, patient_id, condition, diagnosed_date, status, medications, notes, created_at, updated_at`,
      [
        patientId,
        condition,
        body.diagnosedDate || null,
        status,
        medications.length > 0 ? medications : null,
        body.notes || null,
        auth.userId,
      ],
    )

    return NextResponse.json({ chronicCondition: rows[0] })
  } catch (err) {
    console.error("Error creating chronic condition:", err)
    return NextResponse.json({ error: "Failed to create chronic condition" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    await ensureMedicalTables()

    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      medications?: string[]
      notes?: string
    }

    const updates: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (body.status !== undefined) {
      if (!["active", "managed", "resolved"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      updates.push(`status = $${idx++}`)
      params.push(body.status)
    }
    if (body.medications !== undefined) {
      updates.push(`medications = $${idx++}`)
      params.push(body.medications)
    }
    if (body.notes !== undefined) {
      updates.push(`notes = $${idx++}`)
      params.push(body.notes)
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(id)

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE patient_chronic_conditions SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, patient_id, condition, diagnosed_date, status, medications, notes, updated_at`,
      params,
    )

    if (rows.length === 0) return NextResponse.json({ error: "Condition not found" }, { status: 404 })
    return NextResponse.json({ chronicCondition: rows[0] })
  } catch (err) {
    console.error("Error updating chronic condition:", err)
    return NextResponse.json({ error: "Failed to update chronic condition" }, { status: 500 })
  }
}
