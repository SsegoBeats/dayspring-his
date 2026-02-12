import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { submitPesapalOrder } from "@/lib/pesapal"

/**
 * Initiate a Pesapal payment (MTN, Airtel, card, etc.).
 * Returns a redirect URL for the patient to complete payment.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "update") && !can(auth.role, "payments", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const ipnId = process.env.PESAPAL_IPN_ID
    if (!ipnId) {
      return NextResponse.json(
        { error: "Pesapal IPN not configured. Register your IPN URL and set PESAPAL_IPN_ID." },
        { status: 503 },
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get("origin") ?? "http://localhost:3000")
    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/cashier/payment-complete`

    const body = (await req.json().catch(() => ({}))) as {
      billId: string
      amount?: number
      email?: string
      phoneNumber?: string
    }

    const { billId } = body
    if (!billId) {
      return NextResponse.json({ error: "billId is required" }, { status: 400 })
    }

    const billRes = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT b.id, b.final_amount, b.status, b.paid_amount, b.bill_number, p.first_name, p.last_name, p.email, p.phone
         FROM bills b
         JOIN patients p ON p.id = b.patient_id
        WHERE b.id = $1`,
      [billId],
    )
    if (!billRes.rows.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    const bill = billRes.rows[0] as {
      final_amount: number
      status: string
      paid_amount: number
      bill_number: string
      first_name: string
      last_name: string
      email?: string
      phone?: string
    }
    if (String(bill.status || "") === "Paid") {
      return NextResponse.json({ error: "Bill is already paid" }, { status: 400 })
    }

    const finalAmount = Number(bill.final_amount)
    const paidAmount = Number(bill.paid_amount) || 0
    const amountToPay = body.amount ?? (finalAmount - paidAmount)
    if (amountToPay <= 0) {
      return NextResponse.json({ error: "No amount to pay" }, { status: 400 })
    }

    const merchantRef = `BILL-${billId}`.slice(0, 50)
    const phone = body.phoneNumber || bill.phone || ""
    const phoneClean = String(phone).replace(/\D/g, "")
    const ugPhone = phoneClean ? (phoneClean.startsWith("256") ? phoneClean : `256${phoneClean.replace(/^0/, "")}`) : ""

    const result = await submitPesapalOrder({
      id: merchantRef,
      amount: Number(amountToPay.toFixed(2)),
      currency: "UGX",
      description: `Bill ${bill.bill_number || billId} - Dayspring Medical Centre`,
      callbackUrl,
      notificationId: ipnId,
      billingAddress: {
        email_address: body.email || bill.email || "patient@dayspring.local",
        phone_number: ugPhone || undefined,
        first_name: bill.first_name || "",
        last_name: bill.last_name || "",
        country_code: "UG",
      },
    })

    return NextResponse.json({
      redirectUrl: result.redirectUrl,
      orderTrackingId: result.orderTrackingId,
      merchantReference: merchantRef,
      message: "Patient should complete payment at the redirect URL",
    })
  } catch (err: unknown) {
    console.error("[Pesapal] Initiate error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initiate payment" },
      { status: 500 },
    )
  }
}
