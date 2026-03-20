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

    const { rows: [po] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = $1`, [id]
    )
    if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { rows: items } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT poi.*, m.name AS medication_name, m.unit_type FROM purchase_order_items poi
       LEFT JOIN medications m ON m.id = poi.medication_id WHERE poi.purchase_order_id = $1`, [id]
    )
    return NextResponse.json({ purchase_order: po, items })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch purchase order" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "purchase_orders", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { action, cancellation_reason, notes, expected_delivery_date, supplier_id } = body

    // Fetch current PO
    const { rows: [po] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT * FROM purchase_orders WHERE id = $1`, [id]
    )
    if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (action === "approve") {
      if (auth.role !== "Hospital Admin") {
        return NextResponse.json({ error: "Only Hospital Admin can approve purchase orders", code: "UNAUTHORIZED_APPROVAL" }, { status: 403 })
      }
      if (!["pending_approval", "draft"].includes(po.status)) {
        return NextResponse.json({ error: "PO cannot be approved in its current status", code: "PO_NOT_APPROVABLE" }, { status: 400 })
      }
      const { rows: [updated] } = await queryWithSession({ role: auth.role, userId: auth.userId },
        `UPDATE purchase_orders SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
         WHERE id = $2 RETURNING *`, [auth.userId, id]
      )
      return NextResponse.json({ purchase_order: updated })
    }

    if (action === "cancel") {
      if (["received"].includes(po.status)) {
        return NextResponse.json({ error: "Cannot cancel a received PO" }, { status: 400 })
      }
      const { rows: [updated] } = await queryWithSession({ role: auth.role, userId: auth.userId },
        `UPDATE purchase_orders SET status = 'cancelled', cancelled_by = $1, cancelled_at = now(),
         cancellation_reason = $2, updated_at = now() WHERE id = $3 RETURNING *`,
        [auth.userId, cancellation_reason, id]
      )
      return NextResponse.json({ purchase_order: updated })
    }

    // Generic field update (draft only)
    if (po.status !== "draft") {
      return NextResponse.json({ error: "Only draft POs can be edited" }, { status: 400 })
    }
    const fields: string[] = []
    const values: any[] = []
    let idx = 1
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes) }
    if (expected_delivery_date !== undefined) { fields.push(`expected_delivery_date = $${idx++}`); values.push(expected_delivery_date) }
    if (supplier_id !== undefined) { fields.push(`supplier_id = $${idx++}`); values.push(supplier_id) }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    fields.push(`updated_at = now()`)
    values.push(id)

    const { rows: [updated] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE purchase_orders SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values
    )
    return NextResponse.json({ purchase_order: updated })
  } catch (err: any) {
    console.error("Error updating purchase order:", err)
    return NextResponse.json({ error: "Failed to update purchase order" }, { status: 500 })
  }
}
