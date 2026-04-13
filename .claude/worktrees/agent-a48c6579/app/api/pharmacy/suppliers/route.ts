import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT id, name, contact_person, phone, email, address, nda_license_number, payment_terms, is_active, created_at
         FROM suppliers WHERE is_active = true ORDER BY name ASC`
    )
    return NextResponse.json({ suppliers: rows })
  } catch (err: any) {
    console.error("Error fetching suppliers:", err)
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "create") || auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden — admin only", code: "ADMIN_ONLY" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, contact_person, phone, email, address, nda_license_number, payment_terms } = body
    if (!name?.trim()) return NextResponse.json({ error: "Supplier name is required" }, { status: 400 })

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `INSERT INTO suppliers (name, contact_person, phone, email, address, nda_license_number, payment_terms, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name.trim(), contact_person, phone, email, address, nda_license_number, payment_terms, auth.userId]
    )
    return NextResponse.json({ supplier: rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating supplier:", err)
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 })
  }
}
