import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { parse } from "csv-parse/sync"
import { verifyToken, can } from "@/lib/security"
import { withSession } from "@/lib/db"
import {
  getNonMedicationValidationErrors,
  makeNonMedicationValidationDraft,
} from "@/lib/non-medication-inventory-validation"

type BulkSetupUpdate = {
  id?: string
  location?: string | null
  barcode?: string | null
  manufacturer?: string | null
  modelNumber?: string | null
  serialNumber?: string | null
  reorderLevel?: number | string | null
  minStockLevel?: number | string | null
  maxStockLevel?: number | string | null
  description?: string | null
}

function normalizeText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const text = String(value).trim()
  return text || null
}

function normalizeInteger(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, parsed)
}

function parseCsvUpdates(csvContent: string): BulkSetupUpdate[] {
  const records = parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>

  return records.map((record) => ({
    id: record.id,
    location: normalizeText(record.location),
    barcode: normalizeText(record.barcode),
    manufacturer: normalizeText(record.manufacturer),
    modelNumber: normalizeText(record.modelNumber),
    serialNumber: normalizeText(record.serialNumber),
    reorderLevel: normalizeInteger(record.reorderLevel),
    minStockLevel: normalizeInteger(record.minStockLevel),
    maxStockLevel: normalizeInteger(record.maxStockLevel),
    description: normalizeText(record.description),
  }))
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "non_medication_inventory", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      updates?: BulkSetupUpdate[]
      csvContent?: string
    }

    const updates =
      Array.isArray(body.updates) && body.updates.length > 0
        ? body.updates
        : body.csvContent && body.csvContent.trim()
          ? parseCsvUpdates(body.csvContent)
          : []

    if (!updates.length) {
      return NextResponse.json({ error: "No bulk setup updates were provided." }, { status: 400 })
    }

    const normalizedUpdates = updates.map((update) => ({
      id: (update.id || "").trim(),
      location: normalizeText(update.location),
      barcode: normalizeText(update.barcode),
      manufacturer: normalizeText(update.manufacturer),
      modelNumber: normalizeText(update.modelNumber),
      serialNumber: normalizeText(update.serialNumber),
      reorderLevel: normalizeInteger(update.reorderLevel),
      minStockLevel: normalizeInteger(update.minStockLevel),
      maxStockLevel: normalizeInteger(update.maxStockLevel),
      description: normalizeText(update.description),
    }))

    if (normalizedUpdates.some((update) => !update.id)) {
      return NextResponse.json({ error: "Every bulk setup row must include an id." }, { status: 400 })
    }

    const duplicateIds = normalizedUpdates
      .map((update) => update.id)
      .filter((id, index, allIds) => allIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      return NextResponse.json({ error: `Duplicate ids in bulk setup payload: ${Array.from(new Set(duplicateIds)).join(", ")}` }, { status: 400 })
    }

    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const ids = normalizedUpdates.map((update) => update.id)
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
                last_restocked_at,
                created_at,
                updated_at
           FROM non_medication_inventory
          WHERE id = ANY($1::uuid[])`,
        [ids],
      )

      const currentById = new Map(currentRows.map((row) => [row.id, row]))
      const missingIds = ids.filter((id) => !currentById.has(id))
      if (missingIds.length > 0) {
        return { error: `Inventory items not found: ${missingIds.join(", ")}`, status: 404 as const }
      }

      const rowErrors: Array<{ id: string; itemName: string; errors: string[] }> = []
      const preparedUpdates: Array<{ id: string; fields: string[]; values: unknown[] }> = []

      for (const update of normalizedUpdates) {
        const current = currentById.get(update.id)
        if (!current) continue

        const nextDraft = makeNonMedicationValidationDraft({
          itemName: current.item_name,
          itemType: current.item_type,
          itemSubtype: current.item_subtype,
          description: update.description !== undefined ? update.description : current.description,
          manufacturer: update.manufacturer !== undefined ? update.manufacturer : current.manufacturer,
          modelNumber: update.modelNumber !== undefined ? update.modelNumber : current.model_number,
          serialNumber: update.serialNumber !== undefined ? update.serialNumber : current.serial_number,
          stockQuantity: Number(current.stock_quantity) || 0,
          unitOfMeasure: current.unit_of_measure,
          unitPrice: current.unit_price,
          costPrice: current.cost_price,
          reorderLevel: update.reorderLevel !== undefined && update.reorderLevel !== null ? update.reorderLevel : Number(current.reorder_level) || 0,
          minStockLevel:
            update.minStockLevel !== undefined && update.minStockLevel !== null ? update.minStockLevel : Number(current.min_stock_level) || 0,
          maxStockLevel: update.maxStockLevel !== undefined ? update.maxStockLevel : current.max_stock_level,
          location: update.location !== undefined ? update.location : current.location,
          barcode: update.barcode !== undefined ? update.barcode : current.barcode,
          expiryDate: current.expiry_date,
        })

        const validationErrors = getNonMedicationValidationErrors(nextDraft)
        if (validationErrors.length > 0) {
          rowErrors.push({
            id: update.id,
            itemName: current.item_name,
            errors: validationErrors,
          })
          continue
        }

        const fields: string[] = []
        const values: unknown[] = []
        let index = 1

        const maybePush = (column: string, value: unknown, currentValue: unknown) => {
          if (value === undefined) return
          if (value === currentValue || (value === null && currentValue === null)) return
          fields.push(`${column} = $${index++}`)
          values.push(value)
        }

        maybePush("location", update.location, current.location)
        maybePush("barcode", update.barcode, current.barcode)
        maybePush("manufacturer", update.manufacturer, current.manufacturer)
        maybePush("model_number", update.modelNumber, current.model_number)
        maybePush("serial_number", update.serialNumber, current.serial_number)
        maybePush("description", update.description, current.description)
        maybePush("reorder_level", update.reorderLevel, Number(current.reorder_level) || 0)
        maybePush("min_stock_level", update.minStockLevel, Number(current.min_stock_level) || 0)
        maybePush("max_stock_level", update.maxStockLevel, current.max_stock_level)

        if (fields.length === 0) {
          continue
        }

        preparedUpdates.push({ id: update.id, fields, values })
      }

      if (rowErrors.length > 0) {
        return { error: "Some bulk setup rows failed validation.", rowErrors, status: 400 as const }
      }

      if (preparedUpdates.length === 0) {
        return { error: "No inventory setup changes were detected.", status: 400 as const }
      }

      const updatedItems = []
      for (const update of preparedUpdates) {
        const values = [...update.values, update.id]
        const { rows } = await client.query(
          `UPDATE non_medication_inventory
              SET ${update.fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${update.values.length + 1}
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
        if (rows[0]) {
          updatedItems.push(rows[0])
        }
      }

      return { items: updatedItems, count: updatedItems.length }
    })

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("Error applying bulk non-medication setup:", err)
    return NextResponse.json({ error: "Failed to apply bulk inventory setup." }, { status: 500 })
  }
}
