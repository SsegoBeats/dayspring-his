import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  method: z.enum(['cash','card','mobile_money','bank']).optional(),
  patientId: z.string().uuid().optional(),
})

export class PaymentsDataset implements Dataset {
  name = "payments"
  defaultColumns = [
    "receipt_no", "created_at", "amount", "method", "reference",
    "patient_number", "first_name", "last_name", "phone"
  ]

  validateFilters(input: any) { return Filter.parse(input) }

  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT p.receipt_no,
             p.created_at,
             p.amount,
             p.method,
             COALESCE(p.reference,'') as reference,
             pat.patient_number,
             pat.first_name,
             pat.last_name,
             pat.phone
        FROM payments p
        JOIN patients pat ON pat.id = p.patient_id
       WHERE p.created_at >= $1
         AND p.created_at <= $2
         AND ($3::text IS NULL OR p.method = $3)
         AND ($4::uuid IS NULL OR p.patient_id = $4)
         AND ($5::timestamp IS NULL OR p.created_at > $5)
       ORDER BY p.created_at ASC
       LIMIT $6
      `,
      [f.from, f.to, f.method ?? null, f.patientId ?? null, after, pageSize]
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].created_at } : undefined
    return { rows, nextCursor }
  }
}

