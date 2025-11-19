import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function PATCH(req: Request, context: any) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

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

    const fields: string[] = []
    const values: any[] = []

    if (typeof body.name === "string") {
      fields.push("name = $" + (fields.length + 1))
      values.push(body.name.trim())
    }
    if (typeof body.category === "string") {
      fields.push("category = $" + (fields.length + 1))
      values.push(body.category.trim())
    }
    if (typeof body.manufacturer === "string") {
      fields.push("manufacturer = $" + (fields.length + 1))
      values.push(body.manufacturer.trim())
    }
    if (typeof body.stockQuantity === "number" && Number.isFinite(body.stockQuantity)) {
      fields.push("stock_quantity = $" + (fields.length + 1))
      values.push(Math.max(0, Math.trunc(body.stockQuantity)))
    }
    if (typeof body.unitPrice === "number" && Number.isFinite(body.unitPrice)) {
      fields.push("unit_price = $" + (fields.length + 1))
      values.push(body.unitPrice)
    }
    if (typeof body.expiryDate === "string") {
      fields.push("expiry_date = $" + (fields.length + 1))
      values.push(body.expiryDate || null)
    }
    if (typeof body.reorderLevel === "number" && Number.isFinite(body.reorderLevel)) {
      fields.push("reorder_level = $" + (fields.length + 1))
      values.push(Math.max(0, Math.trunc(body.reorderLevel)))
    }
    if (typeof body.barcode === "string") {
      fields.push("barcode = $" + (fields.length + 1))
      values.push(body.barcode.trim() || null)
    }

    if (!fields.length) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const sql = `
      UPDATE medications
         SET ${fields.join(", ")},
             updated_at = NOW()
       WHERE id = $${fields.length + 1}
       RETURNING id, name, generic_name, category, unit_type, stock_quantity, unit_price, expiry_date, manufacturer, reorder_level, barcode
    `

    values.push(id)

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId }, sql, values)

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ medication: rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update medication" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: any) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await context.params
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      "DELETE FROM medications WHERE id = $1 RETURNING id",
      [id],
    )

    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete medication" }, { status: 500 })
  }
}
