import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "read") && !can(auth.role, "payments", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const billId = params.id
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
    return NextResponse.json({ error: "Failed to fetch bill" }, { status: 500 })
  }
}

