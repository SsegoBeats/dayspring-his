import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Active", "Discharged", "Transfer", "All"]).default("All"),
  ward: z.string().optional(),
  bedId: z.string().uuid().optional(),
})

export class BedAssignmentsDataset implements Dataset {
  name = "bed_assignments"
  defaultColumns = [
    "assignment_id", "bed_number", "ward", "bed_type", "status", "assigned_at", "discharge_date",
    "patient_number", "patient_first_name", "patient_last_name", "patient_name", "assigned_by"
  ]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const params: any[] = [f.from, f.to]
    let where = `WHERE ba.assigned_at BETWEEN $1 AND $2`
    if (f.status && f.status !== 'All') {
      params.push(f.status)
      where += ` AND ba.status = $${params.length}`
    }
    if (f.ward) {
      params.push(f.ward)
      where += ` AND b.ward = $${params.length}`
    }
    if (f.bedId) {
      params.push(f.bedId)
      where += ` AND ba.bed_id = $${params.length}`
    }
    if (after) {
      params.push(after)
      where += ` AND ba.assigned_at > $${params.length}`
    }

    const { rows } = await query(
      `SELECT 
         ba.id as assignment_id,
         b.bed_number,
         b.ward,
         b.bed_type,
         ba.status,
         ba.assigned_at,
         ba.discharge_date,
         p.patient_number,
         p.first_name as patient_first_name,
         p.last_name as patient_last_name,
         CONCAT(p.first_name,' ',p.last_name) as patient_name,
         u.name as assigned_by
       FROM bed_assignments ba
       JOIN beds b ON b.id = ba.bed_id
       JOIN patients p ON p.id = ba.patient_id
       JOIN users u ON u.id = ba.assigned_by
       ${where}
       ORDER BY ba.assigned_at ASC
       LIMIT $${params.length + 1}
      `,
      [...params, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].assigned_at } : undefined
    return { rows, nextCursor }
  }
}
