import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { toXLSX } from "@/lib/exports/writers/xlsx"
import { toPDF } from "@/lib/exports/writers/pdf"
import { convertFromUGX } from "@/lib/utils"

const Schema = z.object({
  format: z.enum(["xlsx", "pdf"]).default("xlsx"),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as unknown
    const input = Schema.parse(body)

    const { rows } = await query(
      `SELECT name,
              category,
              manufacturer,
              stock_quantity,
              reorder_level,
              expiry_date,
              unit_price,
              barcode
         FROM medications
        ORDER BY name ASC`,
      [],
    )

    // Load user currency for formatting/meta
    let currency = "UGX"
    try {
      const cur = await query(`SELECT currency FROM user_settings WHERE user_id = $1`, [auth.userId])
      if (cur.rows?.[0]?.currency) currency = cur.rows[0].currency
    } catch {}

    const prepared = rows.map((r: any) => {
      const unitPriceUGX = Number(r.unit_price) || 0
      const unitPriceConverted = convertFromUGX(unitPriceUGX, currency)
      return {
        Medication: r.name,
        Category: r.category,
        Manufacturer: r.manufacturer,
        Stock: Number(r.stock_quantity) || 0,
        Reorder: Number(r.reorder_level) || 0,
        Expiry: r.expiry_date ?? "",
        UnitPrice: Number(unitPriceConverted),
        Barcode: r.barcode ?? "",
      }
    })

    const filenameBase = `inventory-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`
    const currencyLabel = currency === "USD" ? "$" : currency

    // Load logo as data URL for watermark/header, same pattern as other exports
    const origin = new URL(req.url).origin
    const safeLogoUrl = `${origin}/logo0.png`
    let logoDataUrl: string | undefined = undefined
    try {
      const r = await fetch(safeLogoUrl)
      if (r.ok) {
        const ct = r.headers.get("content-type") || "image/png"
        const ab = await r.arrayBuffer()
        const b = Buffer.from(ab)
        logoDataUrl = `data:${ct};base64,${b.toString("base64")}`
      }
    } catch {}

    if (input.format === "xlsx") {
      const buf = await toXLSX(prepared, {
        meta: { title: "Pharmacy Inventory", exportedBy: auth.email, timestamp: new Date().toISOString() },
        columns: ["Medication", "Category", "Manufacturer", "Stock", "Reorder", "Expiry", "UnitPrice", "Barcode"],
        headerTitle: "Dayspring Medical Center",
        headerSubtitle: "Pharmacy Inventory",
        currencyCode: currency,
        logoDataUrl,
        headerMap: {
          UnitPrice: `Unit Price (${currencyLabel})`,
        },
      })
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=${filenameBase}.xlsx`,
        },
      })
    }

    const buf = await toPDF(
      "Dayspring Medical Center - Pharmacy Inventory",
      prepared.map((r) => ({
        medication: r.Medication,
        category: r.Category,
        manufacturer: r.Manufacturer,
        stock: r.Stock,
        reorder: r.Reorder,
        expiry: r.Expiry,
        unit_price: r.UnitPrice,
        barcode: r.Barcode,
      })),
      { userId: auth.userId, timestamp: new Date().toISOString() },
      true,
      {
        subtitle: "Pharmacy Inventory",
        meta: { Currency: currency },
        logoDataUrl,
      },
    )

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filenameBase}.pdf`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to export inventory" }, { status: 500 })
  }
}
