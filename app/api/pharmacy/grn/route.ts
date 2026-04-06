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

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT g.*, s.name AS supplier_name, u.name AS received_by_name,
              COUNT(gi.id) AS item_count
         FROM goods_received_notes g
    LEFT JOIN suppliers s ON s.id = g.supplier_id
    LEFT JOIN users u ON u.id = g.received_by
    LEFT JOIN grn_items gi ON gi.grn_id = g.id
     GROUP BY g.id, s.name, u.name
     ORDER BY g.received_at DESC LIMIT 200`
    )
    return NextResponse.json({ grns: rows })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch GRNs" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { supplier_id, purchase_order_id, invoice_number, notes, items } = body

    if (!supplier_id) return NextResponse.json({ error: "Supplier is required" }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 })

    // Validate linked PO status before starting transaction
    if (purchase_order_id) {
      const { rows: [po] } = await queryWithSession({ role: auth.role, userId: auth.userId },
        `SELECT status FROM purchase_orders WHERE id = $1`, [purchase_order_id]
      )
      if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
      if (!["approved", "partially_received"].includes(po.status)) {
        return NextResponse.json({ error: `Cannot receive stock against a PO with status '${po.status}'. PO must be approved first.`, code: "PO_NOT_APPROVABLE" }, { status: 400 })
      }
    }

    // ⚠️ ALL DML inside withSession — single BEGIN/COMMIT/ROLLBACK
    const grn = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      // 1. Insert GRN header
      const { rows: [newGrn] } = await client.query(
        `INSERT INTO goods_received_notes (grn_number, supplier_id, purchase_order_id, invoice_number, received_by, notes)
         VALUES (
           'GRN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('grn_sequence')::text, 4, '0'),
           $1, $2, $3, $4, $5
         ) RETURNING *`,
        [supplier_id, purchase_order_id || null, invoice_number, auth.userId, notes]
      )

      for (const item of items) {
        // 2. Insert medication batch (FEFO — by expiry_date ASC)
        const { rows: [batch] } = await client.query(
          `INSERT INTO medication_batches (medication_id, batch_number, quantity, expiry_date, received_at, cost_price)
           VALUES ($1, $2, $3, $4, now(), $5) RETURNING id`,
          [item.medication_id, item.batch_number, item.quantity_received, item.expiry_date, item.unit_cost]
        )

        // 3. Insert GRN item with batch_id reference
        await client.query(
          `INSERT INTO grn_items (grn_id, medication_id, batch_id, batch_number, expiry_date, quantity_ordered, quantity_received, unit_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [newGrn.id, item.medication_id, batch.id, item.batch_number, item.expiry_date, item.quantity_ordered ?? null, item.quantity_received, item.unit_cost]
        )

        // 4. Update medication stock
        await client.query(
          `UPDATE medications SET stock_quantity = stock_quantity + $1, last_restocked_at = now() WHERE id = $2`,
          [item.quantity_received, item.medication_id]
        )

        // 5. Insert stock movement audit
        // movement_type CHECK constraint requires capitalized: 'Receive' | 'Adjust' | 'Dispense' | 'Return'
        await client.query(
          `INSERT INTO medication_stock_movements (medication_id, movement_type, quantity, reference, batch_number, expiry_date, created_by)
           VALUES ($1, 'Receive', $2, $3, $4, $5, $6)`,
          [item.medication_id, item.quantity_received, newGrn.grn_number, item.batch_number, item.expiry_date, auth.userId]
        )
      }

      // 6. Update PO quantities + status if linked
      if (purchase_order_id) {
        for (const item of items) {
          await client.query(
            `UPDATE purchase_order_items
             SET quantity_received = quantity_received + $1
             WHERE purchase_order_id = $2 AND medication_id = $3`,
            [item.quantity_received, purchase_order_id, item.medication_id]
          )
        }
        // Recalculate PO status
        const { rows: [statusCheck] } = await client.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE quantity_received >= quantity_ordered) AS fully_received,
             COUNT(*) FILTER (WHERE quantity_received > 0) AS partially_received
           FROM purchase_order_items WHERE purchase_order_id = $1`,
          [purchase_order_id]
        )
        const newStatus = Number(statusCheck.fully_received) === Number(statusCheck.total)
          ? "received"
          : Number(statusCheck.partially_received) > 0 ? "partially_received" : "approved"
        await client.query(
          `UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2`,
          [newStatus, purchase_order_id]
        )
      }

      return newGrn
    })

    return NextResponse.json({ grn }, { status: 201 })
  } catch (err: any) {
    console.error("GRN transaction failed:", err)
    return NextResponse.json({ error: "Stock receipt failed — no changes were made", code: "TRANSACTION_FAILED" }, { status: 500 })
  }
}
