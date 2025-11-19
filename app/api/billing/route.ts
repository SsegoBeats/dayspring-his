import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can, generateReceiptNumber, generateBarcodeData } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const [bills, items] = await Promise.all([
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT b.id, b.bill_number, b.patient_id, p.first_name, p.last_name, b.total_amount, b.tax_amount, b.discount_amount,
                b.final_amount, b.status, b.payment_method, b.paid_amount, b.created_at, b.paid_at
         FROM bills b
         JOIN patients p ON p.id = b.patient_id
         ORDER BY b.created_at DESC
         LIMIT 500`,
      ),
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT bill_id, description, quantity, unit_price, total_price
           FROM bill_items`,
      ),
    ])
    return NextResponse.json({ bills: bills.rows, items: items.rows })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      source?: string
      medications?: { name: string; dosage?: string; frequency?: string; duration?: string }[]
      items?: { description: string; quantity?: number; unitPrice?: number }[]
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const medications = Array.isArray(body.medications) ? body.medications : []
    const manualItems = Array.isArray(body.items) ? body.items : []

    if (medications.length === 0 && manualItems.length === 0) {
      return NextResponse.json({ error: "At least one item or medication is required" }, { status: 400 })
    }

    let items: { description: string; quantity: number; unitPrice: number; totalPrice: number }[] = []

    if (medications.length > 0) {
      // Prescription-derived bill: look up unit prices in medications table
      const lowerNames = medications.map((m) => m.name.toLowerCase())
      let priceMap = new Map<string, number>()
      try {
        const priceRes = await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `SELECT name, unit_price FROM medications WHERE LOWER(name) = ANY($1::text[])`,
          [lowerNames],
        )
        priceMap = new Map<string, number>(
          priceRes.rows.map((r: any) => [String(r.name).toLowerCase(), Number(r.unit_price) || 0]),
        )
      } catch {
        priceMap = new Map()
      }

      items = medications.map((m) => {
        const key = m.name.toLowerCase()
        const unitPrice = priceMap.get(key) ?? 0
        const quantity = 1
        const totalPrice = unitPrice * quantity
        const descriptionParts = [m.name, m.dosage, m.frequency, m.duration].filter(Boolean)
        return {
          description: descriptionParts.join(" - "),
          quantity,
          unitPrice,
          totalPrice,
        }
      })
    } else {
      // Manual bill created by cashier
      items = manualItems.map((it) => {
        const quantity = Number(it.quantity) && Number(it.quantity) > 0 ? Number(it.quantity) : 1
        const unitPrice = Number(it.unitPrice) && Number(it.unitPrice) >= 0 ? Number(it.unitPrice) : 0
        const totalPrice = quantity * unitPrice
        return {
          description: String(it.description || "").trim(),
          quantity,
          unitPrice,
          totalPrice,
        }
      })
    }

    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)
    const taxAmount = 0
    const discountAmount = 0
    const finalAmount = subtotal + taxAmount - discountAmount

    const billNumber = generateReceiptNumber()

    const billInsert = await query(
      `INSERT INTO bills (
         bill_number, patient_id, total_amount, tax_amount, discount_amount,
         final_amount, status, payment_method, paid_amount, barcode, cashier_id
       ) VALUES ($1,$2,$3,$4,$5,$6,'Pending',NULL,0,NULL,NULL)
       RETURNING id`,
      [billNumber, patientId, subtotal, taxAmount, discountAmount, finalAmount],
    )

    const billId = billInsert.rows[0].id as string

    const barcodePayload = generateBarcodeData("payment", billId, {
      patientId,
      source: body.source || (medications.length ? "prescription" : "manual"),
    })

    await query(`UPDATE bills SET barcode = $1 WHERE id = $2`, [barcodePayload, billId])

    for (const item of items) {
      await query(
        `INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [billId, item.description, item.quantity, item.unitPrice, item.totalPrice],
      )
    }

    // Notify cashier department of new bill
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/notify/department`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          department: "cashier",
          title: "New Prescription Bill",
          message: "A new prescription has been sent for billing.",
          payload: { billId, patientId },
        }),
      })
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ id: billId, billNumber })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 })
  }
}


