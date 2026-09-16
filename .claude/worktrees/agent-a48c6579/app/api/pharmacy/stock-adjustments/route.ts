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
      medicationId?: string
      adjustmentType?: "add" | "remove" | "correction"
      quantity?: number
      reason?: string
      batchNumber?: string
      expiryDate?: string
    }

    const medicationId = (body.medicationId || "").trim()
    const adjustmentType = body.adjustmentType || "correction"
    const qty = Number(body.quantity ?? 0)
    const reason = body.reason ? String(body.reason).trim() || null : null
    const batchNumber = body.batchNumber ? String(body.batchNumber).trim() || null : null
    const expiryDate = body.expiryDate || null

    if (!medicationId) {
      return NextResponse.json({ error: "medicationId is required" }, { status: 400 })
    }
    if (!Number.isFinite(qty) || qty < 0) {
      return NextResponse.json({ error: "quantity must be a non-negative number" }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: "reason is required for stock adjustments" }, { status: 400 })
    }

    // Get current stock
    const { rows: medRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT stock_quantity FROM medications WHERE id = $1`,
      [medicationId],
    )

    if (!medRows.length) {
      return NextResponse.json({ error: "Medication not found" }, { status: 404 })
    }

    const currentStock = Number(medRows[0].stock_quantity) || 0
    let newStock = currentStock

    // Calculate new stock based on adjustment type
    if (adjustmentType === "add") {
      newStock = currentStock + qty
    } else if (adjustmentType === "remove") {
      newStock = Math.max(0, currentStock - qty)
    } else {
      // correction: set to exact quantity
      newStock = qty
    }

    // Update medication stock
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE medications SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newStock, medicationId],
    )

    // Record the adjustment in stock movements
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO medication_stock_movements (
         medication_id,
         movement_type,
         quantity,
         reference,
         batch_number,
         expiry_date,
         created_by
       ) VALUES ($1, 'Adjust', $2, $3, $4, $5, $6)`,
      [
        medicationId,
        adjustmentType === "add" ? qty : adjustmentType === "remove" ? -qty : newStock - currentStock,
        reason,
        batchNumber,
        expiryDate,
        auth.userId,
      ],
    )

    return NextResponse.json({
      ok: true,
      medicationId,
      previousStock: currentStock,
      newStock,
      adjustmentType,
    })
  } catch (err: any) {
    console.error("Error processing stock adjustment:", err)
    return NextResponse.json({ error: "Failed to process stock adjustment" }, { status: 500 })
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
    const medicationId = (url.searchParams.get("medicationId") || "").trim()
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500)

    const params: any[] = []
    let where = "WHERE msm.movement_type = 'Adjust'"
    if (medicationId) {
      where += " AND msm.medication_id = $1"
      params.push(medicationId)
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT msm.id,
               msm.medication_id,
               m.name AS medication_name,
               msm.movement_type,
               msm.quantity,
               msm.reference,
               msm.batch_number,
               msm.expiry_date,
               msm.created_at,
               u.name AS created_by_name
          FROM medication_stock_movements msm
          JOIN medications m ON m.id = msm.medication_id
          LEFT JOIN users u ON u.id = msm.created_by
          ${where}
         ORDER BY msm.created_at DESC
         LIMIT ${limit}
      `,
      params,
    )

    return NextResponse.json({ adjustments: rows })
  } catch (err: any) {
    console.error("Error fetching stock adjustments:", err)
    return NextResponse.json({ error: "Failed to fetch stock adjustments" }, { status: 500 })
  }
}

