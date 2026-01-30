import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      itemName?: string
      itemType?: string
      description?: string
      manufacturer?: string
      modelNumber?: string
      serialNumber?: string
      stockQuantity?: number
      unitOfMeasure?: string
      unitPrice?: number
      costPrice?: number
      reorderLevel?: number
      minStockLevel?: number
      maxStockLevel?: number
      location?: string
      barcode?: string
      expiryDate?: string
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.itemName !== undefined) {
      updates.push(`item_name = $${paramIndex++}`)
      values.push((body.itemName || "").trim())
    }
    if (body.itemType !== undefined) {
      updates.push(`item_type = $${paramIndex++}`)
      values.push((body.itemType || "").trim())
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push((body.description || "").trim() || null)
    }
    if (body.manufacturer !== undefined) {
      updates.push(`manufacturer = $${paramIndex++}`)
      values.push((body.manufacturer || "").trim() || null)
    }
    if (body.modelNumber !== undefined) {
      updates.push(`model_number = $${paramIndex++}`)
      values.push((body.modelNumber || "").trim() || null)
    }
    if (body.serialNumber !== undefined) {
      updates.push(`serial_number = $${paramIndex++}`)
      values.push((body.serialNumber || "").trim() || null)
    }
    if (body.stockQuantity !== undefined) {
      updates.push(`stock_quantity = $${paramIndex++}`)
      values.push(Math.max(0, Math.trunc(body.stockQuantity as number)))
    }
    if (body.unitOfMeasure !== undefined) {
      updates.push(`unit_of_measure = $${paramIndex++}`)
      values.push((body.unitOfMeasure || "units").trim())
    }
    if (body.unitPrice !== undefined) {
      updates.push(`unit_price = $${paramIndex++}`)
      values.push(Number.isFinite(body.unitPrice) ? Number(body.unitPrice) : null)
    }
    if (body.costPrice !== undefined) {
      updates.push(`cost_price = $${paramIndex++}`)
      values.push(Number.isFinite(body.costPrice) ? Number(body.costPrice) : null)
    }
    if (body.reorderLevel !== undefined) {
      updates.push(`reorder_level = $${paramIndex++}`)
      values.push(Math.max(0, Math.trunc(body.reorderLevel as number)))
    }
    if (body.minStockLevel !== undefined) {
      updates.push(`min_stock_level = $${paramIndex++}`)
      values.push(Math.max(0, Math.trunc(body.minStockLevel as number)))
    }
    if (body.maxStockLevel !== undefined) {
      updates.push(`max_stock_level = $${paramIndex++}`)
      values.push(Number.isFinite(body.maxStockLevel) ? Math.max(0, Math.trunc(body.maxStockLevel as number)) : null)
    }
    if (body.location !== undefined) {
      updates.push(`location = $${paramIndex++}`)
      values.push((body.location || "").trim() || null)
    }
    if (body.barcode !== undefined) {
      updates.push(`barcode = $${paramIndex++}`)
      values.push(body.barcode ? String(body.barcode).trim() || null : null)
    }
    if (body.expiryDate !== undefined) {
      updates.push(`expiry_date = $${paramIndex++}`)
      values.push(body.expiryDate || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    values.push(params.id)

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE non_medication_inventory
        SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING id,
                  item_name,
                  item_type,
                  description,
                  manufacturer,
                  model_number,
                  serial_number,
                  stock_quantity,
                  unit_of_measure,
                  unit_price,
                  cost_price,
                  reorder_level,
                  min_stock_level,
                  max_stock_level,
                  location,
                  barcode,
                  expiry_date,
                  last_restocked_at,
                  created_at,
                  updated_at`,
      values,
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    return NextResponse.json({ item: rows[0] })
  } catch (err: any) {
    console.error("Error updating non-medication inventory item:", err)
    return NextResponse.json({ error: "Failed to update non-medication inventory item" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM non_medication_inventory WHERE id = $1 RETURNING id`,
      [params.id],
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Error deleting non-medication inventory item:", err)
    return NextResponse.json({ error: "Failed to delete non-medication inventory item" }, { status: 500 })
  }
}
