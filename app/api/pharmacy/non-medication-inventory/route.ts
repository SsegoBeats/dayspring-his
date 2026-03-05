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
    if (!can(auth.role, "non_medication_inventory", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id,
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
              updated_at
         FROM non_medication_inventory
        ORDER BY item_type, item_name ASC
        LIMIT 1000`,
      [],
    )
    return NextResponse.json({ items: rows })
  } catch (err: any) {
    console.error("Error fetching non-medication inventory:", err)
    return NextResponse.json({ error: "Failed to fetch non-medication inventory" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "non_medication_inventory", "update") && !can(auth.role, "non_medication_inventory", "create")) {
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

    const itemName = (body.itemName || "").trim()
    const itemType = (body.itemType || "").trim()
    const description = (body.description || "").trim() || null
    const manufacturer = (body.manufacturer || "").trim() || null
    const modelNumber = (body.modelNumber || "").trim() || null
    const serialNumber = (body.serialNumber || "").trim() || null
    const stockQuantity = Number.isFinite(body.stockQuantity) ? Math.max(0, Math.trunc(body.stockQuantity as number)) : 0
    const unitOfMeasure = (body.unitOfMeasure || "units").trim()
    const unitPrice = Number.isFinite(body.unitPrice) ? Number(body.unitPrice) : null
    const costPrice = Number.isFinite(body.costPrice) ? Number(body.costPrice) : null
    const reorderLevel = Number.isFinite(body.reorderLevel)
      ? Math.max(0, Math.trunc(body.reorderLevel as number))
      : 0
    const minStockLevel = Number.isFinite(body.minStockLevel)
      ? Math.max(0, Math.trunc(body.minStockLevel as number))
      : 0
    const maxStockLevel = Number.isFinite(body.maxStockLevel)
      ? Math.max(0, Math.trunc(body.maxStockLevel as number))
      : null
    const location = (body.location || "").trim() || null
    const barcode = body.barcode ? String(body.barcode).trim() || null : null
    const expiryDate = body.expiryDate || null

    if (!itemName || !itemType) {
      return NextResponse.json({ error: "itemName and itemType are required" }, { status: 400 })
    }

    const validTypes = [
      "Medical Equipment",
      "Personal Protective Gear",
      "Patient Care Items",
      "Diagnostic Equipment",
      "Surgical & Procedure Equipment",
      "Consumables and Supplies",
    ]
    if (!validTypes.includes(itemType)) {
      return NextResponse.json({ error: "Invalid itemType" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO non_medication_inventory (
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
         created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
      [
        itemName,
        itemType,
        description,
        manufacturer,
        modelNumber,
        serialNumber,
        stockQuantity,
        unitOfMeasure,
        unitPrice,
        costPrice,
        reorderLevel,
        minStockLevel,
        maxStockLevel,
        location,
        barcode,
        expiryDate,
        stockQuantity > 0 ? new Date().toISOString() : null,
        auth.userId,
      ],
    )

    return NextResponse.json({ item: rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating non-medication inventory item:", err)
    return NextResponse.json({ error: "Failed to create non-medication inventory item" }, { status: 500 })
  }
}
