import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Pending", "Paid", "Partially Paid", "Cancelled"]).optional(),
})

export class BillingDataset implements Dataset {
  name = "billing"
  defaultColumns = ["bill_number", "patient_name", "final_amount", "status", "paid_at"]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT b.bill_number,
             CONCAT(p.first_name,' ',p.last_name) as patient_name,
             b.final_amount,
             b.status,
             b.paid_at
      FROM bills b
      JOIN patients p ON p.id = b.patient_id
      WHERE b.created_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR b.status = $3)
        AND ($4::timestamp IS NULL OR b.created_at > $4)
      ORDER BY b.created_at ASC
      LIMIT $5
      `,
      [f.from, f.to, f.status ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].paid_at || rows[rows.length - 1].created_at } : undefined
    return { rows, nextCursor }
  }
}


