import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id,
              name,
              generic_name,
              category,
              unit_type,
              stock_quantity,
              unit_price,
              expiry_date,
              manufacturer,
              reorder_level,
              barcode
         FROM medications
        ORDER BY name ASC
        LIMIT 1000`,
    )
    return NextResponse.json({ medications: rows })
  } catch (err: any) {
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
      expiryDate?: string
      reorderLevel?: number
      barcode?: string
    }

    const name = (body.name || "").trim()
    const category = (body.category || "").trim()
    const manufacturer = (body.manufacturer || "").trim()
    const stockQuantity = Number.isFinite(body.stockQuantity) ? Math.max(0, Math.trunc(body.stockQuantity as number)) : 0
    const unitPrice = Number.isFinite(body.unitPrice) ? Number(body.unitPrice) : 0
    const expiryDate = body.expiryDate || null
    const reorderLevel = Number.isFinite(body.reorderLevel)
      ? Math.max(0, Math.trunc(body.reorderLevel as number))
      : 0
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
         reorder_level,
         expiry_date,
         manufacturer,
         barcode
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,
                 name,
                 generic_name,
                 category,
                 unit_type,
                 stock_quantity,
                 unit_price,
                 expiry_date,
                 manufacturer,
                 reorder_level,
                 barcode`,
      [name, null, category, unitType, stockQuantity, unitPrice, reorderLevel, expiryDate, manufacturer, barcode],
    )

    return NextResponse.json({ medication: rows[0] }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create medication" }, { status: 500 })
  }
}


