import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Pending", "Dispensed", "Cancelled"]).optional(),
})

export class PharmacyDataset implements Dataset {
  name = "pharmacy"
  defaultColumns = ["prescription_id", "patient_name", "medication_name", "status", "dispensed_at"]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT pr.id as prescription_id,
             CONCAT(p.first_name,' ',p.last_name) as patient_name,
             pr.medication_name,
             pr.status,
             pr.dispensed_at,
             pr.created_at
      FROM prescriptions pr
      JOIN patients p ON p.id = pr.patient_id
      WHERE pr.created_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR pr.status = $3)
        AND ($4::timestamp IS NULL OR pr.created_at > $4)
      ORDER BY pr.created_at ASC
      LIMIT $5
      `,
      [f.from, f.to, f.status ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].created_at } : undefined
    return { rows, nextCursor }
  }
}


