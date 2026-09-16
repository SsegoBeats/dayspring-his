import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

function mapTypeForDb(category: string): "Assessment"|"Intervention"|"Observation"|"Medication"|"Other" {
  const c = (category || "").toLowerCase()
  if (c === "procedure") return "Intervention"
  if (c === "assessment") return "Assessment"
  if (c === "medication") return "Medication"
  if (c === "observation") return "Observation"
  return "Other"
}

function mapTypeForUi(noteType: string): "assessment"|"medication"|"procedure"|"observation"|"other" {
  const t = (noteType || "").toLowerCase()
  if (t === "intervention") return "procedure"
  if (t === "assessment") return "assessment"
  if (t === "medication") return "medication"
  if (t === "observation") return "observation"
  return "other"
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "medical", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 200)))
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    const { rows } = await query(
      `SELECT nn.id, nn.patient_id, nn.nurse_id, nn.note_type, nn.note, nn.created_at,
              p.first_name, p.last_name, u.name AS nurse_name
         FROM nursing_notes nn
         LEFT JOIN patients p ON p.id = nn.patient_id
         LEFT JOIN users u ON u.id = nn.nurse_id
        WHERE nn.patient_id = $1
        ORDER BY nn.created_at DESC
        LIMIT $2`,
      [patientId, limit]
    )

    const notes = rows.map((r: any) => {
      const d = new Date(r.created_at)
      return {
        id: r.id,
        patientId: r.patient_id,
        patientName: [r.first_name, r.last_name].filter(Boolean).join(" "),
        nurseName: r.nurse_name || "",
        date: d.toISOString().slice(0, 10),
        time: d.toTimeString().slice(0, 5),
        category: mapTypeForUi(r.note_type),
        note: r.note,
      }
    })
    return NextResponse.json({ notes })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to load nursing notes", details: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "medical", "create")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const patientId = body.patientId as string
    const category = body.category as string
    const note = body.note as string
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    if (!note) return NextResponse.json({ error: "note is required" }, { status: 400 })

    const noteType = mapTypeForDb(category)
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO nursing_notes (patient_id, nurse_id, note_type, note)
       VALUES ($1,$2,$3,$4)
       RETURNING id, created_at`,
      [patientId, auth.userId, noteType, note]
    )

    const id = rows[0].id
    const ts = new Date(rows[0].created_at)
    return NextResponse.json({ id, createdAt: ts.toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to add nursing note", details: e.message }, { status: 500 })
  }
}

