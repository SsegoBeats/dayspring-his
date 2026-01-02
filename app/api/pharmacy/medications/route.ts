import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await query(
      `SELECT id,
              name,
              generic_name,
              category,
              unit_type,
              stock_quantity,
              unit_price,
              cost_price,
              expiry_date,
              manufacturer,
              reorder_level,
              min_stock_level,
              max_stock_level,
              last_restocked_at,
              barcode
         FROM medications
        ORDER BY name ASC
        LIMIT 1000`,
    )
    return NextResponse.json({ medications: rows })
  } catch (err: any) {
    console.error("Error fetching medications:", err)
    return NextResponse.json({ error: "Failed to fetch medications" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update") && !can(auth.role, "pharmacy", "create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string
      category?: string
      manufacturer?: string
      stockQuantity?: number
      unitPrice?: number
      costPrice?: number
      expiryDate?: string
      reorderLevel?: number
      minStockLevel?: number
      maxStockLevel?: number
      barcode?: string
    }

    const name = (body.name || "").trim()
    const category = (body.category || "").trim()
    const manufacturer = (body.manufacturer || "").trim()
    const stockQuantity = Number.isFinite(body.stockQuantity) ? Math.max(0, Math.trunc(body.stockQuantity as number)) : 0
    const unitPrice = Number.isFinite(body.unitPrice) ? Number(body.unitPrice) : 0
    const costPrice = Number.isFinite(body.costPrice) ? Number(body.costPrice) : null
    const expiryDate = body.expiryDate || null
    const reorderLevel = Number.isFinite(body.reorderLevel)
      ? Math.max(0, Math.trunc(body.reorderLevel as number))
      : 0
    const minStockLevel = Number.isFinite(body.minStockLevel)
      ? Math.max(0, Math.trunc(body.minStockLevel as number))
      : null
    const maxStockLevel = Number.isFinite(body.maxStockLevel)
      ? Math.max(0, Math.trunc(body.maxStockLevel as number))
      : null
    const barcode = body.barcode ? String(body.barcode).trim() || null : null

    if (!name || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 })
    }

    const unitType = "Other"

    const { rows } = await query(
      `INSERT INTO medications (
         name,
         generic_name,
         category,
         unit_type,
         stock_quantity,
         unit_price,
         cost_price,
         reorder_level,
         min_stock_level,
         max_stock_level,
         expiry_date,
         manufacturer,
         barcode,
         last_restocked_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id,
                 name,
                 generic_name,
                 category,
                 unit_type,
                 stock_quantity,
                 unit_price,
                 cost_price,
                 expiry_date,
                 manufacturer,
                 reorder_level,
                 min_stock_level,
                 max_stock_level,
                 last_restocked_at,
                 barcode`,
      [name, null, category, unitType, stockQuantity, unitPrice, costPrice, reorderLevel, minStockLevel, maxStockLevel, expiryDate, manufacturer, barcode, stockQuantity > 0 ? new Date().toISOString() : null],
    )

    return NextResponse.json({ medication: rows[0] }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create medication" }, { status: 500 })
  }
}


