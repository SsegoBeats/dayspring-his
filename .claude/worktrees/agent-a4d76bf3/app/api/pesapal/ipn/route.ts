import { NextResponse } from "next/server"
import { getPesapalTransactionStatus } from "@/lib/pesapal"
import { withSession } from "@/lib/db"
import { createPaymentForBillWithClient, findPaymentByReferenceWithClient } from "@/lib/billing-payments"

/**
 * Parse merchant reference to get billId and user's chosen payment method.
 * Format: BILL-{billId}-MOBILE, BILL-{billId}-CARD, or legacy BILL-{billId}
 */
function parseMerchantRef(merchantRef: string, pesapalMethod?: string): { billId: string | null; paymentMethod: string } {
  const withSuffix = merchantRef.match(/^BILL-(.+)-(CARD|MOBILE)$/i)
  if (withSuffix) {
    const billId = withSuffix[1].trim()
    const method = withSuffix[2].toUpperCase() === "CARD" ? "Card" : "Mobile Money"
    return { billId, paymentMethod: method }
  }
  const plain = merchantRef.match(/^BILL-(.+)$/)
  const billId = plain?.[1]?.trim() || null
  return { billId, paymentMethod: pesapalMethod || "Mobile Money" }
}

async function processSuccessfulPayment(billId: string, orderTrackingId: string, paymentMethod: string, amountPaid: number) {
  // Never mark as paid when Pesapal reports zero or missing amount (e.g. user only visited payment page and left)
  if (!amountPaid || amountPaid <= 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Pesapal] Skipping bill update: no amount paid", billId, orderTrackingId)
    }
    return
  }
  await withSession({ role: "Hospital Admin", userId: "ipn" }, async (client) => {
    if (orderTrackingId) {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [orderTrackingId])
      const existingPayment = await findPaymentByReferenceWithClient(client, orderTrackingId)
      if (existingPayment) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Pesapal] Skipping duplicate IPN payment:", billId, orderTrackingId)
        }
        return
      }
    }

    const billRes = await client.query<{ bill_number: string | null; final_amount: number; paid_amount: number }>(
      `SELECT bill_number, final_amount, paid_amount
         FROM bills
        WHERE id = $1 AND status != 'Paid'
        FOR UPDATE`,
      [billId],
    )
    if (!billRes.rows.length) return

    const bill = billRes.rows[0]
    const finalAmount = Number(bill.final_amount)
    const currentPaidAmount = Number(bill.paid_amount) || 0
    const effectiveAmount = Math.min(amountPaid, Math.max(0, finalAmount - currentPaidAmount))
    if (!(effectiveAmount > 0)) return

    const newPaidAmount = currentPaidAmount + effectiveAmount
    const status = newPaidAmount >= finalAmount ? "Paid" : "Partially Paid"
    const paidAmountToSet = status === "Paid" ? finalAmount : newPaidAmount

    await client.query(
      `UPDATE bills SET
         status = $2,
         payment_method = $3,
         paid_amount = $4,
         paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
       WHERE id = $1`,
      [billId, status, paymentMethod, paidAmountToSet],
    )

    await createPaymentForBillWithClient(client, {
      billId,
      amount: effectiveAmount,
      paymentMethod,
      reference: orderTrackingId,
      description:
        currentPaidAmount > 0
          ? `Online balance payment for invoice ${bill.bill_number || billId.slice(0, 8)}`
          : `Online payment for invoice ${bill.bill_number || billId.slice(0, 8)}`,
      useFullBillBreakdown: currentPaidAmount <= 0 && Math.abs(effectiveAmount - finalAmount) < 0.01,
    })
  })
  if (process.env.NODE_ENV === "development") {
    console.log("[Pesapal] Bill updated:", billId, orderTrackingId)
  }
}

/**
 * Pesapal IPN (Instant Payment Notification) endpoint.
 * Pesapal calls this when payment status changes.
 * Register this URL at: https://pay.pesapal.com/iframe/PesapalIframe3/IpnRegistration
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      OrderNotificationType?: string
      OrderTrackingId?: string
      OrderMerchantReference?: string
    }
    const orderTrackingId = body.OrderTrackingId
    const merchantRef = body.OrderMerchantReference

    if (!orderTrackingId || !merchantRef) {
      return NextResponse.json({
        orderNotificationType: "IPNCHANGE",
        orderTrackingId: orderTrackingId || "",
        orderMerchantReference: merchantRef || "",
        status: 500,
      })
    }

    const status = await getPesapalTransactionStatus(orderTrackingId)

    if (status.payment_status_description === "COMPLETED" && status.status_code === 1) {
      const { billId, paymentMethod } = parseMerchantRef(merchantRef, status.payment_method)
      if (billId) {
        const amountPaid = Number(status.amount) || 0
        await processSuccessfulPayment(billId, orderTrackingId, paymentMethod, amountPaid)
      }
    }

    return NextResponse.json({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference: merchantRef,
      status: 200,
    })
  } catch (err) {
    console.error("[Pesapal] IPN error:", err)
    return NextResponse.json(
      { orderNotificationType: "IPNCHANGE", status: 500 },
      { status: 200 },
    )
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const orderTrackingId = url.searchParams.get("OrderTrackingId")
    const merchantRef = url.searchParams.get("OrderMerchantReference")

    if (!orderTrackingId || !merchantRef) {
      return NextResponse.json({ status: 500, message: "Missing params" })
    }

    const status = await getPesapalTransactionStatus(orderTrackingId)

    if (status.payment_status_description === "COMPLETED" && status.status_code === 1) {
      const { billId, paymentMethod } = parseMerchantRef(merchantRef, status.payment_method)
      if (billId) {
        const amountPaid = Number(status.amount) || 0
        await processSuccessfulPayment(billId, orderTrackingId, paymentMethod, amountPaid)
      }
    }

    return NextResponse.json({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference: merchantRef,
      status: 200,
    })
  } catch (err) {
    console.error("[Pesapal] IPN GET error:", err)
    return NextResponse.json({ status: 500 }, { status: 200 })
  }
}
