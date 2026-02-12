import { NextResponse } from "next/server"
import { getPesapalTransactionStatus } from "@/lib/pesapal"
import { queryWithSession } from "@/lib/db"

async function processSuccessfulPayment(billId: string, orderTrackingId: string, paymentMethod: string, amountPaid: number) {
  const billRes = await queryWithSession(
    { role: "Hospital Admin", userId: "ipn" },
    `SELECT final_amount, paid_amount FROM bills WHERE id = $1 AND status != 'Paid'`,
    [billId],
  )
  if (!billRes.rows.length) return
  const bill = billRes.rows[0] as { final_amount: number; paid_amount: number }
  const finalAmount = Number(bill.final_amount)
  const currentPaidAmount = Number(bill.paid_amount) || 0
  const effectiveAmount = amountPaid > 0 ? amountPaid : Math.max(0, finalAmount - currentPaidAmount)
  const newPaidAmount = currentPaidAmount + effectiveAmount
  const status = newPaidAmount >= finalAmount ? "Paid" : "Partially Paid"
  const paidAmountToSet = status === "Paid" ? finalAmount : newPaidAmount

  await queryWithSession(
    { role: "Hospital Admin", userId: "ipn" },
    `UPDATE bills SET
       status = $2,
       payment_method = $3,
       paid_amount = $4,
       paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
     WHERE id = $1`,
    [billId, status, paymentMethod, paidAmountToSet],
  )
  console.log("[Pesapal] Bill updated:", billId, orderTrackingId, status, "amount:", effectiveAmount)
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
      const billIdMatch = merchantRef.match(/^BILL-(.+)$/)
      const billId = billIdMatch?.[1]
      if (billId) {
        const paymentMethod = status.payment_method || "Mobile Money"
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
      const billIdMatch = merchantRef.match(/^BILL-(.+)$/)
      const billId = billIdMatch?.[1]
      if (billId) {
        const paymentMethod = status.payment_method || "Mobile Money"
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
