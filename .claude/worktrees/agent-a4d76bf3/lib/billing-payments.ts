import type { PoolClient } from "pg"
import { query } from "@/lib/db"

type Queryable = Pick<PoolClient, "query">

export type NormalizedPaymentMethod = "cash" | "card" | "mobile_money" | "bank"

export type RecordedPayment = {
  paymentId: string
  receiptNo: string
  method: NormalizedPaymentMethod
  existing: boolean
}

type CreatePaymentForBillInput = {
  billId: string
  amount: number
  paymentMethod?: string | null
  cashierId?: string | null
  reference?: string | null
  description?: string | null
  useFullBillBreakdown?: boolean
}

type PaymentLookupRow = {
  id: string
  receipt_no: string
  method: NormalizedPaymentMethod
}

type BillRow = {
  bill_number: string | null
  patient_id: string
}

type BillItemRow = {
  description: string
  total_price: number
}

let paymentsBillLinkEnsured = false

export function normalizePaymentMethod(input?: string | null): NormalizedPaymentMethod {
  const value = String(input || "").trim().toLowerCase()
  if (value === "card" || value.includes("card")) return "card"
  if (value === "mobile_money" || value.includes("mobile")) return "mobile_money"
  if (value === "bank" || value.includes("bank")) return "bank"
  return "cash"
}

export async function ensurePaymentsBillLink(client?: Queryable) {
  if (paymentsBillLinkEnsured) return

  const runner = client ?? { query }
  await runner.query(
    `ALTER TABLE payments
       ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES bills(id) ON DELETE SET NULL`,
  )
  await runner.query(
    `CREATE INDEX IF NOT EXISTS idx_payments_bill_created ON payments(bill_id, created_at DESC)`,
  )

  paymentsBillLinkEnsured = true
}

export async function findPaymentByReferenceWithClient(
  client: Queryable,
  reference?: string | null,
): Promise<RecordedPayment | null> {
  await ensurePaymentsBillLink(client)
  const normalizedReference = reference?.trim() ? reference.trim().slice(0, 100) : null
  if (!normalizedReference) return null

  const existing = await client.query<PaymentLookupRow>(
    `SELECT id, receipt_no, method
       FROM payments
      WHERE reference = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [normalizedReference],
  )

  if (!existing.rows.length) return null

  return {
    paymentId: existing.rows[0].id,
    receiptNo: existing.rows[0].receipt_no,
    method: existing.rows[0].method,
    existing: true,
  }
}

export async function createPaymentForBillWithClient(
  client: Queryable,
  input: CreatePaymentForBillInput,
): Promise<RecordedPayment | null> {
  await ensurePaymentsBillLink(client)
  const amount = Number(input.amount || 0)
  if (!(amount > 0)) return null

  const normalizedReference = input.reference?.trim() ? input.reference.trim().slice(0, 100) : null
  if (normalizedReference) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [normalizedReference])
    const existing = await findPaymentByReferenceWithClient(client, normalizedReference)
    if (existing) return existing
  }

  const billRes = await client.query<BillRow>(
    `SELECT bill_number, patient_id
       FROM bills
      WHERE id = $1
      LIMIT 1`,
    [input.billId],
  )

  if (!billRes.rows.length) {
    throw new Error("Bill not found for payment recording")
  }

  const bill = billRes.rows[0]
  const method = normalizePaymentMethod(input.paymentMethod)
  const paymentInsert = await client.query<PaymentLookupRow>(
    `INSERT INTO payments (patient_id, bill_id, amount, method, reference, cashier_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, receipt_no, method`,
    [bill.patient_id, input.billId, amount, method, normalizedReference, input.cashierId || null],
  )

  const payment = paymentInsert.rows[0]
  const paymentItems = input.useFullBillBreakdown
    ? await buildFullBreakdownItems(client, input.billId)
    : [
        {
          description:
            input.description?.trim() ||
            `Payment for invoice ${bill.bill_number || input.billId.slice(0, 8)}`,
          amount,
        },
      ]

  for (const item of paymentItems) {
    await client.query(
      `INSERT INTO payment_items (payment_id, description, amount)
       VALUES ($1, $2, $3)`,
      [payment.id, item.description, item.amount],
    )
  }

  return {
    paymentId: payment.id,
    receiptNo: payment.receipt_no,
    method: payment.method,
    existing: false,
  }
}

async function buildFullBreakdownItems(client: Queryable, billId: string) {
  const itemRes = await client.query<BillItemRow>(
    `SELECT description, total_price
       FROM bill_items
      WHERE bill_id = $1
      ORDER BY created_at ASC`,
    [billId],
  )

  if (!itemRes.rows.length) {
    return []
  }

  return itemRes.rows.map((item) => ({
    description: item.description,
    amount: Number(item.total_price) || 0,
  }))
}
