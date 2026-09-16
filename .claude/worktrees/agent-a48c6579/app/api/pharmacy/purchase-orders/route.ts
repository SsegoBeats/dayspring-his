import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const supplierId = searchParams.get("supplier_id")

    let where = "WHERE 1=1"
    const params: any[] = []
    let idx = 1
    if (status) { where += ` AND po.status = $${idx++}`; params.push(status) }
    if (supplierId) { where += ` AND po.supplier_id = $${idx++}`; params.push(supplierId) }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT po.*,
              s.name AS supplier_name,
              COUNT(poi.id) AS item_count,
              COALESCE(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_value,
              cb.full_name AS created_by_name
         FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    LEFT JOIN users cb ON cb.id = po.created_by
        ${where}
     GROUP BY po.id, s.name, cb.full_name
     ORDER BY po.created_at DESC
        LIMIT 200`,
      params
    )
    return NextResponse.json({ purchase_orders: rows })
  } catch (err: any) {
    console.error("Error fetching purchase orders:", err)
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "purchase_orders", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { supplier_id, expected_delivery_date, notes, items, submit_for_approval } = body

    if (!supplier_id) return NextResponse.json({ error: "Supplier is required" }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 })

    // ⚠️ Atomic — PO header + all items in one transaction to prevent orphaned POs
    const po = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const { rows: [newPo] } = await client.query(
        `INSERT INTO purchase_orders (po_number, supplier_id, status, notes, expected_delivery_date, created_by)
         VALUES (
           'LPO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('lpo_sequence')::text, 4, '0'),
           $1, $2, $3, $4, $5
         ) RETURNING *`,
        [supplier_id, submit_for_approval ? "pending_approval" : "draft", notes, expected_delivery_date, auth.userId]
      )
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, medication_id, quantity_ordered, unit_cost, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [newPo.id, item.medication_id, item.quantity_ordered, item.unit_cost, item.notes]
        )
      }
      return newPo
    })

    return NextResponse.json({ purchase_order: po }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating purchase order:", err)
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 })
  }
}
