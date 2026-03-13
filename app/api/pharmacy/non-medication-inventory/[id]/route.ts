import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"
import {
  isValidNonMedicationCategory,
  isValidSubtypeForCategory,
  type NonMedicationCategory,
} from "@/lib/constants/non-medication-inventory"
import { normalizeInventoryName } from "@/lib/non-medication-inventory-insights"
import {
  getNonMedicationValidationErrors,
  makeNonMedicationValidationDraft,
} from "@/lib/non-medication-inventory-validation"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "non_medication_inventory", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const { rows } = await client.query(
        `SELECT id,
                item_name,
                item_type,
                item_subtype,
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
                updated_at
           FROM non_medication_inventory
          WHERE id = $1`,
        [params.id],
      )

      if (!rows.length) {
        return null
      }

      const item = rows[0]
      const normalizedName = normalizeInventoryName(item.item_name)

      const [duplicateRows, movementRows, stockTakingRows] = await Promise.all([
        client.query(
          `SELECT id,
                  item_name,
                  item_type,
                  item_subtype,
                  stock_quantity,
                  unit_of_measure,
                  location,
                  updated_at
             FROM non_medication_inventory
            WHERE id <> $1
              AND regexp_replace(lower(item_name), '[^a-z0-9]+', '', 'g') = $2
            ORDER BY updated_at DESC, item_name ASC`,
          [params.id, normalizedName],
        ),
        client.query(
          `SELECT movement.id,
                  movement.movement_type,
                  movement.quantity,
                  movement.reference,
                  movement.notes,
                  movement.created_at,
                  TRIM(CONCAT(COALESCE(user_record.first_name, ''), ' ', COALESCE(user_record.last_name, ''))) AS actor_name
             FROM non_medication_stock_movements movement
             LEFT JOIN users user_record ON user_record.id = movement.created_by
            WHERE movement.item_id = $1
            ORDER BY movement.created_at DESC
            LIMIT 8`,
          [params.id],
        ),
        client.query(
          `SELECT stock_take.id,
                  stock_take.recorded_quantity,
                  stock_take.system_quantity,
                  stock_take.variance,
                  stock_take.notes,
                  stock_take.status,
                  stock_take.taken_at,
                  TRIM(CONCAT(COALESCE(user_record.first_name, ''), ' ', COALESCE(user_record.last_name, ''))) AS actor_name
             FROM non_medication_stock_taking stock_take
             LEFT JOIN users user_record ON user_record.id = stock_take.taken_by
            WHERE stock_take.item_id = $1
            ORDER BY stock_take.taken_at DESC
            LIMIT 6`,
          [params.id],
        ),
      ])

      return {
        item,
        duplicates: duplicateRows.rows,
        movements: movementRows.rows,
        stockTaking: stockTakingRows.rows,
      }
    })

    if (!result) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("Error fetching non-medication inventory item:", err)
    return NextResponse.json({ error: "Failed to fetch non-medication inventory item" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "non_medication_inventory", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      itemName?: string
      itemType?: string
      itemSubtype?: string
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
    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const { rows: currentRows } = await client.query(
        `SELECT id,
                item_name,
                item_type,
                item_subtype,
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
                last_restocked_at
           FROM non_medication_inventory
          WHERE id = $1`,
        [params.id],
      )

      if (!currentRows.length) {
        return { error: "Item not found", status: 404 as const }
      }

      const current = currentRows[0]
      const nextItemType = body.itemType !== undefined ? (body.itemType || "").trim() : current.item_type
      const nextItemSubtype = body.itemSubtype !== undefined ? (body.itemSubtype || "").trim() || null : current.item_subtype

      if (!nextItemType || !isValidNonMedicationCategory(nextItemType)) {
        return { error: "Invalid itemType", status: 400 as const }
      }

      if (nextItemSubtype && !isValidSubtypeForCategory(nextItemType as NonMedicationCategory, nextItemSubtype)) {
        return { error: "Invalid itemSubtype for this category", status: 400 as const }
      }

      const nextDraft = makeNonMedicationValidationDraft({
        itemName: body.itemName !== undefined ? (body.itemName || "").trim() : current.item_name,
        itemType: nextItemType,
        itemSubtype: nextItemSubtype,
        description: body.description !== undefined ? (body.description || "").trim() || null : current.description,
        manufacturer: body.manufacturer !== undefined ? (body.manufacturer || "").trim() || null : current.manufacturer,
        modelNumber: body.modelNumber !== undefined ? (body.modelNumber || "").trim() || null : current.model_number,
        serialNumber: body.serialNumber !== undefined ? (body.serialNumber || "").trim() || null : current.serial_number,
        stockQuantity:
          body.stockQuantity !== undefined ? Math.max(0, Math.trunc(body.stockQuantity as number)) : Number(current.stock_quantity) || 0,
        unitOfMeasure: body.unitOfMeasure !== undefined ? (body.unitOfMeasure || "units").trim() : current.unit_of_measure,
        unitPrice: body.unitPrice !== undefined ? (Number.isFinite(body.unitPrice) ? Number(body.unitPrice) : null) : current.unit_price,
        costPrice: body.costPrice !== undefined ? (Number.isFinite(body.costPrice) ? Number(body.costPrice) : null) : current.cost_price,
        reorderLevel:
          body.reorderLevel !== undefined ? Math.max(0, Math.trunc(body.reorderLevel as number)) : Number(current.reorder_level) || 0,
        minStockLevel:
          body.minStockLevel !== undefined
            ? Math.max(0, Math.trunc(body.minStockLevel as number))
            : Number(current.min_stock_level) || 0,
        maxStockLevel:
          body.maxStockLevel !== undefined
            ? Number.isFinite(body.maxStockLevel)
              ? Math.max(0, Math.trunc(body.maxStockLevel as number))
              : null
            : current.max_stock_level,
        location: body.location !== undefined ? (body.location || "").trim() || null : current.location,
        barcode: body.barcode !== undefined ? (body.barcode ? String(body.barcode).trim() || null : null) : current.barcode,
        expiryDate: body.expiryDate !== undefined ? body.expiryDate || null : current.expiry_date,
      })

      const validationErrors = getNonMedicationValidationErrors(nextDraft)
      if (validationErrors.length > 0) {
        return { error: validationErrors[0], errors: validationErrors, status: 400 as const }
      }

      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1
      let stockDelta: number | null = null

      if (body.itemName !== undefined) {
        const itemName = nextDraft.itemName
        updates.push(`item_name = $${paramIndex++}`)
        values.push(itemName)
      }
      if (body.itemType !== undefined) {
        updates.push(`item_type = $${paramIndex++}`)
        values.push(nextItemType)
      }
      if (body.itemSubtype !== undefined) {
        updates.push(`item_subtype = $${paramIndex++}`)
        values.push(nextItemSubtype)
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
        const nextQuantity = Math.max(0, Math.trunc(body.stockQuantity as number))
        stockDelta = nextQuantity - (Number(current.stock_quantity) || 0)
        updates.push(`stock_quantity = $${paramIndex++}`)
        values.push(nextQuantity)
        if (stockDelta > 0) {
          updates.push(`last_restocked_at = CURRENT_TIMESTAMP`)
        }
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
        return { error: "No updates provided", status: 400 as const }
      }

      values.push(params.id)

      const { rows } = await client.query(
        `UPDATE non_medication_inventory
            SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramIndex}
          RETURNING id,
                    item_name,
                    item_type,
                    item_subtype,
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

      if (!rows.length) {
        return { error: "Item not found", status: 404 as const }
      }

      if (stockDelta !== null && stockDelta !== 0) {
        await client.query(
          `INSERT INTO non_medication_stock_movements (
             item_id,
             movement_type,
             quantity,
             reference,
             notes,
             created_by
           ) VALUES ($1, 'Adjust', $2, $3, $4, $5)`,
          [
            params.id,
            stockDelta,
            "Inventory workspace adjustment",
            stockDelta > 0 ? "Stock increased from admin inventory workspace" : "Stock reduced from admin inventory workspace",
            auth.userId,
          ],
        )
      }

      return { item: rows[0] }
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error, errors: "errors" in result ? result.errors : undefined }, { status: result.status })
    }

    return NextResponse.json(result)
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
    if (!can(auth.role, "non_medication_inventory", "delete") && !can(auth.role, "non_medication_inventory", "update")) {
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
