import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { toPDF } from "@/lib/exports/writers/pdf"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // Cashier/Receptionist/Admin can view
    if (!(can(auth.role, 'payments', 'read') || can(auth.role, 'billing', 'read'))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const id = params.id
    const { rows } = await query(
      `SELECT p.id, p.receipt_no, p.amount, p.method, p.reference, p.created_at,
              pat.first_name, pat.last_name, pat.patient_number, pat.phone
         FROM payments p
         JOIN patients pat ON pat.id = p.patient_id
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
      const u = await query(`SELECT name FROM users WHERE id = (SELECT cashier_id FROM payments WHERE id = $1)`, [id])
      cashier = u.rows?.[0]?.name || ''
    } catch {}

    // Load line items if any
    const items = await query(`SELECT description, amount FROM payment_items WHERE payment_id = $1 ORDER BY description ASC`, [id])
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
    if (items.rows.length) {
      data = items.rows.map((it: any) => ({ item: it.description, amount: Number(it.amount).toFixed(2) }))
      // Add a total row visually by appending one more object
      data.push({ item: 'TOTAL', amount: Number(r.amount).toFixed(2) })
    } else {
      // Fallback to key/value table
      data = [
        { field: 'Receipt No', value: r.receipt_no },
        { field: 'Patient', value: `${r.first_name} ${r.last_name}`.trim() },
        { field: 'Patient Number', value: r.patient_number },
        { field: 'Phone', value: r.phone || '' },
        { field: 'Amount', value: `${Number(r.amount).toLocaleString()}` },
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
      const resp = await fetch(`${origin}/logo0.png`)
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || 'image/png'
        const ab = await resp.arrayBuffer()
        logoDataUrl = `data:${ct};base64,${Buffer.from(ab).toString('base64')}`
      }
    } catch {}

    const title = 'Dayspring Medical Center'
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

    // Currency-aware wording
    let currency = 'UGX'
    try {
      const cur = await query(`SELECT currency FROM user_settings WHERE user_id = $1`, [auth.userId])
      if (cur.rows?.[0]?.currency) currency = cur.rows[0].currency
    } catch {}
    const unit = currency === 'USD' ? 'Dollars' : currency === 'KES' ? 'Shillings' : 'Shillings'
    const amountWords = numberToWords(Number(r.amount)) + ` ${unit} Only`

    const buf = await toPDF(title, data as any[], { userId: auth.userId, timestamp: new Date().toISOString() }, false, {
      colors: { headerBg: [14,165,233], headerText: [255,255,255], rowAltBg: [243,244,246], text: [17,24,39] },
      logoDataUrl,
      subtitle: 'Dayspring Medical Center - Information System',
      meta: { ...meta, 'Amount in Words': amountWords },
    })
    const res = new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename=receipt-${r.receipt_no}.pdf` } })
    return res
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}
