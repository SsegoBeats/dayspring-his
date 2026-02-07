import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      itemId?: string
      recordedQuantity?: number
      notes?: string
    }

    const itemId = (body.itemId || "").trim()
    const recordedQuantity = Number(body.recordedQuantity ?? 0)

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 })
    }
    if (!Number.isFinite(recordedQuantity) || recordedQuantity < 0) {
      return NextResponse.json({ error: "recordedQuantity must be a non-negative number" }, { status: 400 })
    }

    // Get current system quantity
    const { rows: itemRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT stock_quantity FROM non_medication_inventory WHERE id = $1`,
      [itemId],
    )

    if (!itemRows.length) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const systemQuantity = Number(itemRows[0].stock_quantity) || 0
    const variance = recordedQuantity - systemQuantity
    const notes = body.notes ? String(body.notes).trim() || null : null

    // Record the stock taking
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO non_medication_stock_taking (
         item_id,
         recorded_quantity,
         system_quantity,
         variance,
         notes,
         taken_by
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, item_id, recorded_quantity, system_quantity, variance, notes, taken_at, status`,
      [itemId, recordedQuantity, systemQuantity, variance, notes, auth.userId],
    )

    return NextResponse.json({ stockTaking: rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error("Error recording non-medication stock taking:", err)
    return NextResponse.json({ error: "Failed to record stock taking" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const itemId = (url.searchParams.get("itemId") || "").trim()
    const status = (url.searchParams.get("status") || "").trim()
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500)

    const params: any[] = []
    let where = "WHERE 1=1"
    if (itemId) {
      where += " AND st.item_id = $" + (params.length + 1)
      params.push(itemId)
    }
    if (status) {
      where += " AND st.status = $" + (params.length + 1)
      params.push(status)
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT st.id,
               st.item_id,
               nmi.item_name,
               st.recorded_quantity,
               st.system_quantity,
               st.variance,
               st.notes,
               st.taken_at,
               st.status,
               u.name AS taken_by_name
          FROM non_medication_stock_taking st
          JOIN non_medication_inventory nmi ON nmi.id = st.item_id
          LEFT JOIN users u ON u.id = st.taken_by
          ${where}
         ORDER BY st.taken_at DESC
         LIMIT ${limit}
      `,
      params,
    )

    return NextResponse.json({ stockTakings: rows })
  } catch (err: any) {
    console.error("Error fetching non-medication stock takings:", err)
    return NextResponse.json({ error: "Failed to fetch stock takings" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      id?: string
      status?: "Pending" | "Approved" | "Rejected"
      applyAdjustment?: boolean
    }

    const id = (body.id || "").trim()
    const status = body.status

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    if (!status || !["Pending", "Approved", "Rejected"].includes(status)) {
      return NextResponse.json({ error: "valid status is required" }, { status: 400 })
    }

    // Get the stock taking record
    const { rows: stRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT item_id, variance FROM non_medication_stock_taking WHERE id = $1`,
      [id],
    )

    if (!stRows.length) {
      return NextResponse.json({ error: "Stock taking record not found" }, { status: 404 })
    }

    const { item_id, variance } = stRows[0]

    // Update status
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE non_medication_stock_taking SET status = $1 WHERE id = $2`,
      [status, id],
    )

    // If approved and applyAdjustment is true, adjust the stock
    if (status === "Approved" && body.applyAdjustment && variance !== 0) {
      const adjustmentType = variance > 0 ? "Issue" : "Receive"
      const quantity = Math.abs(variance)

      // Update item stock
      const { rows: itemRows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT stock_quantity FROM non_medication_inventory WHERE id = $1`,
        [item_id],
      )

      if (itemRows.length) {
        const currentStock = Number(itemRows[0].stock_quantity) || 0
        const newStock = variance > 0 ? currentStock + quantity : Math.max(0, currentStock - quantity)

        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `UPDATE non_medication_inventory SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newStock, item_id],
        )

        // Record the adjustment
        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `INSERT INTO non_medication_stock_movements (
             item_id,
             movement_type,
             quantity,
             reference,
             created_by
           ) VALUES ($1, 'Adjust', $2, $3, $4)`,
          [
            item_id,
            variance,
            `Stock taking adjustment (ID: ${id})`,
            auth.userId,
          ],
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Error updating non-medication stock taking:", err)
    return NextResponse.json({ error: "Failed to update stock taking" }, { status: 500 })
  }
}
