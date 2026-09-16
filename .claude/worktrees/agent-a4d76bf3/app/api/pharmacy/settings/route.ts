// app/api/pharmacy/settings/route.ts
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

    // Upsert defaults on first fetch
    await queryWithSession({ role: auth.role, userId: auth.userId },
      `INSERT INTO pharmacy_settings (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [auth.userId]
    )

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT * FROM pharmacy_settings WHERE user_id = $1`,
      [auth.userId]
    )
    return NextResponse.json({ settings: rows[0] ?? null })
  } catch (err: any) {
    console.error("Error fetching pharmacy settings:", err)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    const allowed = [
      "low_stock_threshold_override", "expiry_warning_days", "expiry_critical_days",
      "default_dispensing_notes", "preferred_print_format", "print_include_logo",
      "enable_controlled_drug_alerts", "notify_low_stock", "notify_expiry",
      "notify_new_prescriptions", "notify_po_approved"
    ]
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${idx++}`)
        values.push(body[key])
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

    fields.push(`updated_at = now()`)
    values.push(auth.userId)

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE pharmacy_settings SET ${fields.join(", ")} WHERE user_id = $${idx} RETURNING *`,
      values
    )
    if (rows.length === 0) return NextResponse.json({ error: "Settings not found" }, { status: 404 })
    return NextResponse.json({ settings: rows[0] })
  } catch (err: any) {
    console.error("Error updating pharmacy settings:", err)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
