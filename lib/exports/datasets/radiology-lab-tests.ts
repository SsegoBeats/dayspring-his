import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.string().optional(), // Accepts "Pending", "Completed", "Cancelled", etc.
  modality: z.string().optional(),
  assignedRadiologistId: z.string().uuid().optional(),
})

export class RadiologyLabTestsDataset implements Dataset {
  name = "radiology_lab_tests"
  defaultColumns = ["study_id", "ordered_at", "status", "patient_name", "test_name", "test_type", "priority", "assigned_radiologist", "completed_at"]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const radiologyModalities = ["X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammography"]
    
    const { rows } = await query(
      `
      SELECT lt.id as study_id,
             lt.ordered_at,
             lt.status,
             TRIM(CONCAT(p.first_name, ' ', p.last_name)) as patient_name,
             lt.test_name,
             lt.test_type,
             lt.priority,
             lt.completed_at,
             u.name as assigned_radiologist
      FROM lab_tests lt
      JOIN patients p ON p.id = lt.patient_id
      LEFT JOIN users u ON u.id = lt.assigned_radiologist_id
      WHERE lt.ordered_at BETWEEN $1 AND $2
        AND lt.test_name IN ('X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography')
        AND ($3::text IS NULL OR lt.status = $3)
        AND ($4::text IS NULL OR lt.test_name = $4)
        AND ($5::uuid IS NULL OR lt.assigned_radiologist_id = $5)
        AND ($6::timestamp IS NULL OR lt.ordered_at > $6)
      ORDER BY lt.ordered_at ASC
      LIMIT $7
      `,
      [f.from, f.to, f.status ?? null, f.modality ?? null, f.assignedRadiologistId ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].ordered_at } : undefined
    return { rows, nextCursor }
  }
}
