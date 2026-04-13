import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const fields: string[] = []
    const values: any[] = []
    let idx = 1
    const allowed = ["name", "contact_person", "phone", "email", "address", "nda_license_number", "payment_terms", "is_active"]
    for (const key of allowed) {
      if (key in body) { fields.push(`${key} = $${idx++}`); values.push(body[key]) }
    }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    fields.push(`updated_at = now()`)
    values.push(id)

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE suppliers SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values
    )
    if (rows.length === 0) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    return NextResponse.json({ supplier: rows[0] })
  } catch (err: any) {
    console.error("Error updating supplier:", err)
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE suppliers SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`, [id]
    )
    if (rows.length === 0) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Error deleting supplier:", err)
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 })
  }
}
