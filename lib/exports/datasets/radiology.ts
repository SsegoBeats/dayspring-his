import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]).optional(),
})

export class RadiologyDataset implements Dataset {
  name = "radiology"
  defaultColumns = ["study_id", "ordered_at", "status", "patient_name", "test_name", "radiologist"]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT r.id as study_id,
             r.ordered_at,
             r.status,
             CONCAT(p.first_name,' ',p.last_name) as patient_name,
             r.test_name,
             u.name as radiologist
      FROM radiology_tests r
      JOIN patients p ON p.id = r.patient_id
      LEFT JOIN users u ON u.id = r.radiologist_id
      WHERE r.ordered_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR r.status = $3)
        AND ($4::timestamp IS NULL OR r.ordered_at > $4)
      ORDER BY r.ordered_at ASC
      LIMIT $5
      `,
      [f.from, f.to, f.status ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].ordered_at } : undefined
    return { rows, nextCursor }
  }
}


