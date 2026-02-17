import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, query } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "read") && !can(auth.role, "payments", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: billId } = await params
    if (!billId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const [billRes, itemsRes] = await Promise.all([
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT b.id,
                b.bill_number,
                b.patient_id,
                p.first_name,
                p.last_name,
                p.patient_number,
                b.total_amount,
                b.tax_amount,
                b.discount_amount,
                b.final_amount,
                b.status,
                b.payment_method,
                b.paid_amount,
                b.created_at,
                b.paid_at,
                b.barcode
           FROM bills b
           JOIN patients p ON p.id = b.patient_id
          WHERE b.id = $1
          LIMIT 1`,
        [billId],
      ),
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT description, quantity, unit_price, total_price
           FROM bill_items
          WHERE bill_id = $1
          ORDER BY created_at ASC`,
        [billId],
      ),
    ])

    if (!billRes.rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      bill: billRes.rows[0],
      items: itemsRes.rows,
    })
  } catch (err: any) {
    console.error("[billing] GET bill error:", err?.message || err)
    return NextResponse.json(
      { error: err?.message || "Failed to fetch bill" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "update") && !can(auth.role, "payments", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id: billId } = await params
    if (!billId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      paymentMethod?: string
      paidAmount?: number
      notes?: string
    }

    // Get current bill to determine status
    const currentBillRes = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT final_amount, paid_amount, status FROM bills WHERE id = $1`,
      [billId],
    )

    if (!currentBillRes.rows.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    const currentBill = currentBillRes.rows[0]
    const finalAmount = Number(currentBill.final_amount)
    const currentPaidAmount = Number(currentBill.paid_amount) || 0
    const requestedPaidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : finalAmount

    // Validate requested paid amount
    if (Number.isNaN(requestedPaidAmount) || requestedPaidAmount < 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 })
    }
    if (requestedPaidAmount > finalAmount && body.status !== "Cancelled") {
      return NextResponse.json({ error: "Payment amount cannot exceed bill total" }, { status: 400 })
    }

    const paymentMethod = body.paymentMethod != null ? String(body.paymentMethod).trim().slice(0, 50) : null

    // Determine status based on paid amount
    let status = body.status
    if (!status) {
      if (requestedPaidAmount >= finalAmount) {
        status = "Paid"
      } else if (requestedPaidAmount > 0) {
        status = "Partially Paid"
      } else if (body.status === "Cancelled") {
        status = "Cancelled"
      } else {
        status = currentBill.status || "Pending"
      }
    }

    // Calculate new paid amount (add to existing if partial payment)
    const newPaidAmount = body.paidAmount !== undefined 
      ? requestedPaidAmount 
      : (status === "Paid" ? finalAmount : currentPaidAmount)

    const paidNum = Number(newPaidAmount)
    const { rowCount } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE bills SET
         status = $1,
         payment_method = COALESCE($2, payment_method),
         paid_amount = $3::numeric,
         paid_at = CASE WHEN ($3::numeric) > 0 AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
         cashier_id = $4
       WHERE id = $5`,
      [status, paymentMethod, paidNum, auth.userId, billId],
    )

    if (!rowCount || rowCount === 0) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    const updatedRes = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, bill_number, patient_id, status, payment_method, paid_amount, paid_at, final_amount, created_at
       FROM bills WHERE id = $1`,
      [billId],
    )
    const updatedBill = updatedRes.rows[0] ?? null
    return NextResponse.json({ ok: true, bill: updatedBill })
  } catch (err: any) {
    console.error("[billing] PATCH payment error:", err?.message || err)
    return NextResponse.json(
      { error: err?.message || "Failed to process payment" },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id: billId } = await params
    if (!billId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as {
      items?: {
        description: string
        quantity: number
        unitPrice?: number
        total?: number
        itemType?: "medication" | "service"
        serviceCategory?: string
      }[]
      taxAmount?: number
      discountAmount?: number
    }

    // Get current bill to check status
    const currentBillRes = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT status FROM bills WHERE id = $1`,
      [billId],
    )

    if (!currentBillRes.rows.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    const currentStatus = currentBillRes.rows[0].status
    if (currentStatus !== "Pending") {
      return NextResponse.json({ error: "Only pending bills can be edited" }, { status: 400 })
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }

    // Calculate new amounts (support service items with total, or medication items with unitPrice)
    const items = body.items.map((it) => {
      const quantity = Number(it.quantity) && Number(it.quantity) > 0 ? Number(it.quantity) : 1
      const isService =
        it.itemType === "service" ||
        (it.total != null && it.total > 0 && (it.unitPrice == null || it.unitPrice === 0))
      let totalPrice: number
      let unitPrice: number
      if (isService && it.total != null && Number(it.total) >= 0) {
        totalPrice = Number(it.total)
        unitPrice = quantity > 0 ? totalPrice / quantity : 0
      } else {
        unitPrice = Number(it.unitPrice) && Number(it.unitPrice) >= 0 ? Number(it.unitPrice) : 0
        totalPrice = quantity * unitPrice
      }
      return {
        description: String(it.description || "").trim(),
        quantity,
        unitPrice,
        totalPrice,
      }
    })

    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)
    const taxAmount = body.taxAmount !== undefined ? Number(body.taxAmount) : 0
    const discountAmount = body.discountAmount !== undefined ? Number(body.discountAmount) : 0
    const finalAmount = subtotal + taxAmount - discountAmount

    // Update bill
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE bills SET
         total_amount = $1,
         tax_amount = $2,
         discount_amount = $3,
         final_amount = $4
       WHERE id = $5`,
      [subtotal, taxAmount, discountAmount, finalAmount, billId],
    )

    // Delete existing items
    await query(`DELETE FROM bill_items WHERE bill_id = $1`, [billId])

    // Insert new items
    for (const item of items) {
      await query(
        `INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [billId, item.description, item.quantity, item.unitPrice, item.totalPrice],
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update bill" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id: billId } = await params
    if (!billId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const billRes = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT status FROM bills WHERE id = $1`,
      [billId],
    )
    if (!billRes.rows.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }
    const status = (billRes.rows[0] as { status: string }).status
    if (status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending bills can be deleted. Cancel or leave paid/partially paid bills as is." },
        { status: 400 },
      )
    }

    await query(`DELETE FROM bill_items WHERE bill_id = $1`, [billId])
    await query(`DELETE FROM bills WHERE id = $1`, [billId])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 })
  }
}

