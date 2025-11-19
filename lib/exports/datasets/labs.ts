import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]).optional(),
})

export class LabsDataset implements Dataset {
  name = "labs"
  defaultColumns = ["test_id", "ordered_at", "status", "patient_name", "test_name", "doctor_name"]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT l.id as test_id,
             l.ordered_at,
             l.status,
             CONCAT(p.first_name,' ',p.last_name) as patient_name,
             l.test_name,
             u.name as doctor_name
      FROM lab_tests l
      JOIN patients p ON p.id = l.patient_id
      LEFT JOIN users u ON u.id = l.doctor_id
      WHERE l.ordered_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR l.status = $3)
        AND ($4::timestamp IS NULL OR l.ordered_at > $4)
      ORDER BY l.ordered_at ASC
      LIMIT $5
      `,
      [f.from, f.to, f.status ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].ordered_at } : undefined
    return { rows, nextCursor }
  }
}


