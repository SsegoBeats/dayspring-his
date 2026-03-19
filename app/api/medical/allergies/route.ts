import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

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

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get("patientId")

    const whereClause = patientId ? "WHERE pa.patient_id = $1" : ""
    const params = patientId ? [patientId] : []

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT pa.id, pa.patient_id, pa.allergen, pa.reaction, pa.severity,
              pa.diagnosed_date, pa.notes, pa.created_at
       FROM patient_allergies pa
       ${whereClause}
       ORDER BY pa.created_at DESC`,
      params,
    )

    return NextResponse.json({ allergies: rows })
  } catch (err) {
    console.error("Error fetching allergies:", err)
    return NextResponse.json({ error: "Failed to fetch allergies" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      allergen?: string
      reaction?: string
      severity?: string
      diagnosedDate?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    const allergen = (body.allergen || "").trim()
    const reaction = (body.reaction || "").trim()
    const severity = (body.severity || "").trim()

    if (!patientId || !allergen || !reaction || !severity) {
      return NextResponse.json({ error: "patientId, allergen, reaction, and severity are required" }, { status: 400 })
    }

    if (!["mild", "moderate", "severe"].includes(severity)) {
      return NextResponse.json({ error: "severity must be mild, moderate, or severe" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO patient_allergies (patient_id, allergen, reaction, severity, diagnosed_date, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, patient_id, allergen, reaction, severity, diagnosed_date, notes, created_at`,
      [patientId, allergen, reaction, severity, body.diagnosedDate || null, body.notes || null, auth.userId],
    )

    return NextResponse.json({ allergy: rows[0] })
  } catch (err) {
    console.error("Error creating allergy:", err)
    return NextResponse.json({ error: "Failed to create allergy" }, { status: 500 })
  }
}
