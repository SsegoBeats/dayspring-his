import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, query, withSession } from "@/lib/db"
import { createPaymentForBillWithClient } from "@/lib/billing-payments"

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
    return NextResponse.json({ error: "Failed to fetch bill" }, { status: 500 })
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

    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const currentBillRes = await client.query<{
        bill_number: string | null
        final_amount: number
        paid_amount: number | null
        status: string
      }>(
        `SELECT bill_number, final_amount, paid_amount, status
           FROM bills
          WHERE id = $1
          FOR UPDATE`,
        [billId],
      )

      if (!currentBillRes.rows.length) {
        throw new Error("BILL_NOT_FOUND")
      }

      const currentBill = currentBillRes.rows[0]
      const finalAmount = Number(currentBill.final_amount)
      const currentPaidAmount = Number(currentBill.paid_amount) || 0
      const requestedPaidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : finalAmount

      if (Number.isNaN(requestedPaidAmount) || requestedPaidAmount < 0) {
        throw new Error("INVALID_PAYMENT_AMOUNT")
      }

      const cancellingBill = body.status === "Cancelled"
      if (requestedPaidAmount > finalAmount && !cancellingBill) {
        throw new Error("PAYMENT_EXCEEDS_TOTAL")
      }
      if (cancellingBill && currentPaidAmount > 0) {
        throw new Error("CANNOT_CANCEL_PAID_BILL")
      }

      const paymentMethod = body.paymentMethod != null ? String(body.paymentMethod).trim().slice(0, 50) : null
      const paidNum = cancellingBill
        ? 0
        : body.paidAmount !== undefined
          ? requestedPaidAmount
          : requestedPaidAmount >= finalAmount
            ? finalAmount
            : currentPaidAmount

      const status = cancellingBill
        ? "Cancelled"
        : paidNum >= finalAmount
          ? "Paid"
          : paidNum > 0
            ? "Partially Paid"
            : "Pending"

      const transactionAmount = cancellingBill ? 0 : Math.max(0, paidNum - currentPaidAmount)
      if (!cancellingBill && transactionAmount <= 0 && paidNum !== currentPaidAmount) {
        throw new Error("INVALID_PAYMENT_DELTA")
      }

      const updatedRes = await client.query<{
        id: string
        bill_number: string | null
        patient_id: string
        status: string
        payment_method: string | null
        paid_amount: number
        paid_at: string | null
        final_amount: number
        created_at: string
      }>(
        `UPDATE bills SET
           status = $1,
           payment_method = CASE
             WHEN $2::text IS NULL AND $1 = 'Cancelled' THEN NULL
             ELSE COALESCE($2, payment_method)
           END,
           paid_amount = $3::numeric,
           paid_at = CASE
             WHEN $1 = 'Cancelled' THEN NULL
             WHEN ($3::numeric) > 0 AND paid_at IS NULL THEN CURRENT_TIMESTAMP
             ELSE paid_at
           END,
           cashier_id = CASE WHEN $1 = 'Cancelled' THEN cashier_id ELSE $4 END
         WHERE id = $5
         RETURNING id, bill_number, patient_id, status, payment_method, paid_amount, paid_at, final_amount, created_at`,
        [status, paymentMethod, paidNum, auth.userId, billId],
      )

      if (!updatedRes.rows.length) {
        throw new Error("BILL_NOT_FOUND")
      }

      const description =
        status === "Partially Paid"
          ? `Partial payment for invoice ${currentBill.bill_number || billId.slice(0, 8)}`
          : currentPaidAmount > 0
            ? `Balance payment for invoice ${currentBill.bill_number || billId.slice(0, 8)}`
            : `Payment for invoice ${currentBill.bill_number || billId.slice(0, 8)}`

      const payment =
        transactionAmount > 0
          ? await createPaymentForBillWithClient(client, {
              billId,
              amount: transactionAmount,
              paymentMethod,
              cashierId: auth.userId,
              description,
              useFullBillBreakdown:
                currentPaidAmount <= 0 && Math.abs(transactionAmount - finalAmount) < 0.01,
            })
          : null

      return {
        bill: updatedRes.rows[0],
        payment,
        transactionAmount,
      }
    }).catch((error: Error) => {
      switch (error.message) {
        case "BILL_NOT_FOUND":
          return { error: "Bill not found", status: 404 as const }
        case "INVALID_PAYMENT_AMOUNT":
          return { error: "Invalid payment amount", status: 400 as const }
        case "PAYMENT_EXCEEDS_TOTAL":
          return { error: "Payment amount cannot exceed bill total", status: 400 as const }
        case "CANNOT_CANCEL_PAID_BILL":
          return { error: "Bills with recorded payments cannot be cancelled", status: 400 as const }
        case "INVALID_PAYMENT_DELTA":
          return { error: "No new payment amount was provided", status: 400 as const }
        default:
          throw error
      }
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      bill: result.bill,
      payment: result.payment
        ? {
            id: result.payment.paymentId,
            receiptNo: result.payment.receiptNo,
            method: result.payment.method,
          }
        : null,
      transactionAmount: result.transactionAmount,
    })
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
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM bill_items WHERE bill_id = $1`,
      [billId],
    )

    // Insert new items
    for (const item of items) {
      await queryWithSession(
        { role: auth.role, userId: auth.userId },
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
    if (!can(auth.role, "billing", "delete")) {
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

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM bill_items WHERE bill_id = $1`,
      [billId],
    )
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM bills WHERE id = $1`,
      [billId],
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 })
  }
}

