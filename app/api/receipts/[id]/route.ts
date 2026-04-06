import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { toPDF } from "@/lib/exports/writers/pdf"
import { getSystemCurrency } from "@/lib/org"
import { convertFromUGX, formatCurrencyStatic } from "@/lib/utils"
import { groupItemsByCategory } from "@/lib/receipt-utils"
import { ensurePaymentsBillLink } from "@/lib/billing-payments"
import { ORG_NAME, ORG_LOGO_PATH, ORG_SUBTITLE } from "@/lib/org-constants"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // Cashier/Receptionist/Admin can view
    if (!(can(auth.role, 'payments', 'read') || can(auth.role, 'billing', 'read'))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    await ensurePaymentsBillLink()
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT p.id, p.receipt_no, p.amount, p.method, p.reference, p.created_at, p.bill_id,
              pat.first_name, pat.last_name, pat.patient_number, pat.phone,
              b.bill_number, b.final_amount, b.paid_amount
         FROM payments p
         JOIN patients pat ON pat.id = p.patient_id
         LEFT JOIN bills b ON b.id = p.bill_id
        WHERE p.id = $1
        LIMIT 1`,
      [id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const r = rows[0] as any

    // Prepare data
    // Fetch cashier name
    let cashier = ''
    try {
      const u = await queryWithSession({ role: auth.role, userId: auth.userId }, `SELECT name FROM users WHERE id = (SELECT cashier_id FROM payments WHERE id = $1)`, [id])
      cashier = u.rows?.[0]?.name || ''
    } catch {}

    // System-wide currency (Admin-set); must be resolved before building data
    const currency = await getSystemCurrency()
    const amountUGX = Number(r.amount)

    const items = await queryWithSession({ role: auth.role, userId: auth.userId }, `SELECT description, amount FROM payment_items WHERE payment_id = $1 ORDER BY description ASC`, [id])
    let data: any[]
    let meta: Record<string, string> = {
      Report: 'Payment Receipt',
      'Receipt No': r.receipt_no,
      Patient: `${r.first_name} ${r.last_name}`.trim(),
      'Patient Number': r.patient_number,
      Method: r.method,
      Date: new Date(r.created_at).toLocaleString(),
      Cashier: cashier,
    }
    if (r.bill_number) {
      meta["Invoice No"] = r.bill_number
      meta["Invoice Balance"] = formatCurrencyStatic(
        Math.max(0, Number(r.final_amount || 0) - Number(r.paid_amount || 0)),
        currency,
      )
    }
    if (items.rows.length) {
      // Group items by category - payment_items only has description and amount
      // We need to create ReceiptItem-like objects for grouping
      const receiptItems = items.rows.map((it: any) => ({
        description: it.description,
        quantity: 1,
        unitPrice: Number(it.amount),
        total: Number(it.amount)
      }))
      const groupedItems = groupItemsByCategory(receiptItems)
      data = groupedItems.map((it: any) => ({ item: it.description, amount: formatCurrencyStatic(it.total, currency) }))
      data.push({ item: 'TOTAL', amount: formatCurrencyStatic(amountUGX, currency) })
    } else {
      data = [
        { field: 'Receipt No', value: r.receipt_no },
        { field: 'Invoice No', value: r.bill_number || '' },
        { field: 'Patient', value: `${r.first_name} ${r.last_name}`.trim() },
        { field: 'Patient Number', value: r.patient_number },
        { field: 'Phone', value: r.phone || '' },
        { field: 'Amount', value: formatCurrencyStatic(amountUGX, currency) },
        { field: 'Method', value: r.method },
        { field: 'Reference', value: r.reference || '' },
        { field: 'Date', value: new Date(r.created_at).toLocaleString() },
        { field: 'Cashier', value: cashier },
        { field: 'Signature', value: '_____________________________' },
      ]
    }

    // Logo background and branding like other exports
    let logoDataUrl: string | undefined
    try {
      const origin = new URL(req.url).origin
      const resp = await fetch(`${origin}${ORG_LOGO_PATH}`)
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || 'image/png'
        const ab = await resp.arrayBuffer()
        logoDataUrl = `data:${ct};base64,${Buffer.from(ab).toString('base64')}`
      }
    } catch {}

    const title = ORG_NAME
    // Amount in words helper (simple English for integers)
    function numberToWords(n: number): string {
      const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
      const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
      const s = (num: number): string => {
        if (num < 20) return a[num]
        if (num < 100) return b[Math.floor(num/10)] + (num%10? ' ' + a[num%10] : '')
        if (num < 1000) return a[Math.floor(num/100)] + ' Hundred' + (num%100? ' ' + s(num%100) : '')
        if (num < 1_000_000) return s(Math.floor(num/1000)) + ' Thousand' + (num%1000? ' ' + s(num%1000) : '')
        if (num < 1_000_000_000) return s(Math.floor(num/1_000_000)) + ' Million' + (num%1_000_000? ' ' + s(num%1_000_000) : '')
        return s(Math.floor(num/1_000_000_000)) + ' Billion' + (num%1_000_000_000? ' ' + s(num%1_000_000_000) : '')
      }
      return s(Math.floor(n)) || 'Zero'
    }

    const unit = currency === 'USD' ? 'Dollars' : currency === 'KES' ? 'Shillings' : 'Shillings'
    const amountConverted = convertFromUGX(amountUGX, currency)
    const amountWords = numberToWords(amountConverted) + ` ${unit} Only`

    const buf = await toPDF(title, data as any[], { userId: auth.userId, timestamp: new Date().toISOString() }, false, {
      colors: { headerBg: [14,165,233], headerText: [255,255,255], rowAltBg: [243,244,246], text: [17,24,39] },
      logoDataUrl,
      subtitle: `${ORG_NAME} - ${ORG_SUBTITLE}`,
      meta: { ...meta, 'Amount in Words': amountWords },
    })
    const res = new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename=receipt-${r.receipt_no}.pdf` } })
    return res
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}
