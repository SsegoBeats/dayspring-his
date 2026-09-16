import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { toPDF } from "@/lib/exports/writers/pdf"
import { getSystemCurrency } from "@/lib/org"
import { formatCurrencyStatic } from "@/lib/utils"
import { ensurePaymentsBillLink } from "@/lib/billing-payments"
import { ORG_NAME, ORG_LOGO_PATH, ORG_SUBTITLE } from "@/lib/org-constants"

type BillRow = {
  id: string
  bill_number: string | null
  status: string
  payment_method: string | null
  paid_amount: number | string | null
  final_amount: number | string
  total_amount: number | string
  tax_amount: number | string | null
  discount_amount: number | string | null
  created_at: string
  paid_at: string | null
  patient_number: string | null
  patient_name: string
  patient_phone: string | null
  patient_email: string | null
  cashier_name: string | null
}

type BillItemRow = {
  description: string
  quantity: number | string
  unit_price: number | string
  total_price: number | string
}

type PaymentRow = {
  id: string
  receipt_no: string
  amount: number | string
  method: string
  reference: string | null
  created_at: string
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(can(auth.role, "billing", "read") || can(auth.role, "payments", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    await ensurePaymentsBillLink()

    const [billRes, itemsRes, paymentsRes] = await Promise.all([
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT b.id,
                b.bill_number,
                b.status,
                b.payment_method,
                b.paid_amount,
                b.final_amount,
                b.total_amount,
                b.tax_amount,
                b.discount_amount,
                b.created_at,
                b.paid_at,
                p.patient_number,
                TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
                p.phone AS patient_phone,
                p.email AS patient_email,
                u.name AS cashier_name
           FROM bills b
           JOIN patients p ON p.id = b.patient_id
           LEFT JOIN users u ON u.id = b.cashier_id
          WHERE b.id = $1
          LIMIT 1`,
        [id],
      ),
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT description, quantity, unit_price, total_price
           FROM bill_items
          WHERE bill_id = $1
          ORDER BY created_at ASC`,
        [id],
      ),
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT id, receipt_no, amount, method, reference, created_at
           FROM payments
          WHERE bill_id = $1
          ORDER BY created_at ASC`,
        [id],
      ),
    ])

    if (!billRes.rows.length) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const bill = billRes.rows[0] as BillRow
    const items = itemsRes.rows as BillItemRow[]
    const payments = paymentsRes.rows as PaymentRow[]
    const currency = await getSystemCurrency()

    const subtotal = Number(bill.total_amount || 0)
    const tax = Number(bill.tax_amount || 0)
    const discount = Number(bill.discount_amount || 0)
    const total = Number(bill.final_amount || 0)
    const paid = Number(bill.paid_amount || 0)
    const balance = Math.max(0, total - paid)

    const data = items.map((item) => ({
      section: "Invoice Item",
      description: item.description,
      quantity: String(Number(item.quantity) || 0),
      unit_price: formatCurrencyStatic(Number(item.unit_price || 0), currency),
      amount: formatCurrencyStatic(Number(item.total_price || 0), currency),
    }))

    if (!data.length) {
      data.push({
        section: "Invoice Item",
        description: "No bill items recorded",
        quantity: "",
        unit_price: "",
        amount: "",
      })
    }

    data.push(
      {
        section: "Summary",
        description: "Subtotal",
        quantity: "",
        unit_price: "",
        amount: formatCurrencyStatic(subtotal, currency),
      },
      {
        section: "Summary",
        description: "Tax",
        quantity: "",
        unit_price: "",
        amount: formatCurrencyStatic(tax, currency),
      },
      {
        section: "Summary",
        description: "Discount",
        quantity: "",
        unit_price: "",
        amount: formatCurrencyStatic(discount, currency),
      },
      {
        section: "Summary",
        description: "Invoice Total",
        quantity: "",
        unit_price: "",
        amount: formatCurrencyStatic(total, currency),
      },
      {
        section: "Summary",
        description: "Captured Payments",
        quantity: "",
        unit_price: "",
        amount: formatCurrencyStatic(paid, currency),
      },
      {
        section: "Summary",
        description: "Balance Due",
        quantity: "",
        unit_price: "",
        amount: formatCurrencyStatic(balance, currency),
      },
    )

    for (const payment of payments) {
      data.push({
        section: "Payment",
        description: `${payment.receipt_no} | ${payment.method}${payment.reference ? ` | ${payment.reference}` : ""}`,
        quantity: new Date(payment.created_at).toLocaleString(),
        unit_price: "",
        amount: formatCurrencyStatic(Number(payment.amount || 0), currency),
      })
    }

    let logoDataUrl: string | undefined
    try {
      const origin = new URL(req.url).origin
      const resp = await fetch(`${origin}${ORG_LOGO_PATH}`)
      if (resp.ok) {
        const ct = resp.headers.get("content-type") || "image/png"
        const ab = await resp.arrayBuffer()
        logoDataUrl = `data:${ct};base64,${Buffer.from(ab).toString("base64")}`
      }
    } catch {}

    const filenameStem = bill.bill_number || bill.id.slice(0, 8)
    const buf = await toPDF(
      `${ORG_NAME} - Invoice`,
      data,
      { userId: auth.userId, timestamp: new Date().toISOString() },
      false,
      {
        colors: { headerBg: [5, 150, 105], headerText: [255, 255, 255], rowAltBg: [236, 253, 245], text: [17, 24, 39] },
        logoDataUrl,
        subtitle: `${ORG_NAME} - ${ORG_SUBTITLE}`,
        meta: {
          Report: "Invoice",
          "Invoice No": bill.bill_number || filenameStem,
          Patient: bill.patient_name,
          "Patient Number": bill.patient_number || "",
          Phone: bill.patient_phone || "",
          Email: bill.patient_email || "",
          Status: bill.status,
          "Created At": new Date(bill.created_at).toLocaleString(),
          "Paid At": bill.paid_at ? new Date(bill.paid_at).toLocaleString() : "",
          "Payment Method": bill.payment_method || "",
          Cashier: bill.cashier_name || "",
          "Linked Receipts": String(payments.length),
          "Balance Due": formatCurrencyStatic(balance, currency),
        },
      },
    )

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=invoice-${filenameStem}.pdf`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 })
  }
}
