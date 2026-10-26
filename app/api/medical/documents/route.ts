import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { ensureMedicalTables } from "@/lib/medical-tables"

type AuthContext = { role: string; userId: string }

async function getAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  return auth
}

async function getUserFacilityId(auth: AuthContext): Promise<string | null> {
  if (auth.role === "Hospital Admin") return null
  const { rows } = await queryWithSession<{ facility_id?: string }>(
    { role: auth.role, userId: auth.userId },
    `SELECT facility_id FROM users WHERE id = $1 LIMIT 1`,
    [auth.userId],
  )
  return rows[0]?.facility_id ? String(rows[0].facility_id) : null
}

async function canAccessPatientByFacility(auth: AuthContext, patientId: string) {
  if (auth.role === "Hospital Admin") return true
  const facilityId = await getUserFacilityId(auth)
  if (!facilityId) return true
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT 1 FROM patients WHERE id = $1 AND facility_id::text = $2 LIMIT 1`,
    [patientId, facilityId],
  )
  return rows.length > 0
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureMedicalTables()

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get("patientId")

    const facilityId = await getUserFacilityId({ role: auth.role, userId: auth.userId })

    const whereClause = patientId
      ? "WHERE d.patient_id = $1 AND ($2::text IS NULL OR p.facility_id::text = $2)"
      : "WHERE ($1::text IS NULL OR p.facility_id::text = $1)"
    const params = patientId ? [patientId, facilityId] : [facilityId]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT d.id, d.patient_id, d.type, d.file_name, d.file_url, d.notes,
              d.uploaded_at, u.name AS uploaded_by_name
       FROM documents d
       JOIN patients p ON p.id = d.patient_id
       LEFT JOIN users u ON u.id = d.uploaded_by
       ${whereClause}
       ORDER BY d.uploaded_at DESC`,
      params,
    )

    return NextResponse.json({ documents: rows })
  } catch (err: any) {
    if (err?.code === "42P01") return NextResponse.json({ documents: [] })
    console.error("Error fetching documents:", err)
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
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
      type?: string
      fileName?: string
      fileUrl?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    const type = (body.type || "").trim()
    const fileUrl = (body.fileUrl || "").trim()
    const fileName = (body.fileName || "").trim()

    if (!patientId || !type || !fileUrl) {
      return NextResponse.json({ error: "patientId, type, and fileUrl are required" }, { status: 400 })
    }

    const validTypes = ["ID", "INSURANCE", "GUARANTEE", "REFERRAL", "PREAUTH", "CLAIM_FORM", "CONSENT", "OTHER"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 })
    }

    if (!(await canAccessPatientByFacility({ role: auth.role, userId: auth.userId }, patientId))) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO documents (patient_id, type, file_name, file_url, notes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, patient_id, type, file_name, file_url, notes, uploaded_at`,
      [patientId, type, fileName || null, fileUrl, body.notes || null, auth.userId],
    )

    return NextResponse.json({ document: rows[0] })
  } catch (err) {
    console.error("Error uploading document:", err)
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
  }
}
