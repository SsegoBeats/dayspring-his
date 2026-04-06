import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows: [grn] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT g.*, s.name AS supplier_name, s.address AS supplier_address,
              s.nda_license_number AS supplier_nda,
              u.name AS received_by_name
         FROM goods_received_notes g
    LEFT JOIN suppliers s ON s.id = g.supplier_id
    LEFT JOIN users u ON u.id = g.received_by
        WHERE g.id = $1`, [id]
    )
    if (!grn) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { rows: items } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT gi.*, m.name AS medication_name, m.generic_name, m.unit_type
         FROM grn_items gi
    LEFT JOIN medications m ON m.id = gi.medication_id
        WHERE gi.grn_id = $1 ORDER BY m.name`, [id]
    )
    return NextResponse.json({ grn, items })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch GRN" }, { status: 500 })
  }
}
