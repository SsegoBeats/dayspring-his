import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

const CreatePayment = z.object({
  patientId: z.string().uuid(),
  amount: z.number().positive().optional(),
  method: z.enum(['cash','card','mobile_money','bank']),
  reference: z.string().max(100).optional().nullable(),
  items: z.array(z.object({ description: z.string().min(1), amount: z.number().positive() })).optional().nullable(),
})

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "payments", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT p.id, p.receipt_no, p.patient_id, p.amount, p.method, p.reference, p.created_at,
            pat.first_name, pat.last_name, pat.patient_number
       FROM payments p
       JOIN patients pat ON pat.id = p.patient_id
      WHERE ($1::uuid IS NULL OR p.patient_id = $1)
      ORDER BY p.created_at DESC
      LIMIT 500`,
    [patientId]
  )
  return NextResponse.json({ payments: rows })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "payments", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const data = CreatePayment.parse(await req.json())
    let amount = data.amount || 0
    if (data.items && data.items.length) {
      const sum = data.items.reduce((a, b) => a + b.amount, 0)
      amount = sum
    }
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO payments (patient_id, amount, method, reference, cashier_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, receipt_no`,
      [data.patientId, amount, data.method, data.reference || null, auth.userId]
    )
    const paymentId = rows[0].id as string
    if (data.items && data.items.length) {
      for (const it of data.items) {
        await queryWithSession({ role: auth.role, userId: auth.userId }, `INSERT INTO payment_items (payment_id, description, amount) VALUES ($1,$2,$3)`, [paymentId, it.description, it.amount])
      }
    }
    await writeAuditLog({ userId: auth.userId, action: "PAYMENT_CREATE", entityType: "Payment", entityId: paymentId, details: { ...data, amount } })
    return NextResponse.json({ id: paymentId, receiptNo: rows[0].receipt_no })
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}
