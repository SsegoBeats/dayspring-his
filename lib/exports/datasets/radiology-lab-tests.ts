import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  statuses: z.array(z.string()).optional(),
  modality: z.string().optional(),
  assignedRadiologistId: z.string().uuid().optional(),
  assignmentScope: z.enum(["unassigned"]).optional(),
  q: z.string().optional(),
})

export class RadiologyLabTestsDataset implements Dataset {
  name = "radiology_lab_tests"
  defaultColumns = [
    "study_id",
    "patient_name",
    "patient_number",
    "study_name",
    "status",
    "priority",
    "ordered_by",
    "assigned_radiologist",
    "accession_number",
    "ordered_at",
    "completed_at",
  ]

  validateFilters(input: any) {
    return Filter.parse(input)
  }

  async queryPage(_ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const params: any[] = [f.from, f.to]
    const whereParts = [
      `lt.ordered_at BETWEEN $1 AND $2`,
      `lt.test_name IN ('X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography', 'Fluoroscopy', 'Nuclear Medicine', 'PET Scan', 'Angiography')`,
    ]

    if (f.statuses && f.statuses.length > 0) {
      // Normalize both sides: DB "In Progress" → "in progress", UI "in-progress" → "in progress"
      params.push(f.statuses.map((status) => status.toLowerCase().replace(/-/g, " ")))
      whereParts.push(`REPLACE(LOWER(lt.status), '-', ' ') = ANY($${params.length}::text[])`)
    }

    if (f.modality) {
      params.push(f.modality)
      whereParts.push(`lt.test_name = $${params.length}`)
    }

    if (f.assignedRadiologistId) {
      params.push(f.assignedRadiologistId)
      whereParts.push(`lt.assigned_radiologist_id = $${params.length}`)
    }

    if (f.assignmentScope === "unassigned") {
      whereParts.push(`lt.assigned_radiologist_id IS NULL`)
    }

    if (f.q) {
      params.push(`%${f.q.toLowerCase()}%`)
      whereParts.push(
        `(LOWER(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) LIKE $${params.length}
          OR LOWER(COALESCE(p.patient_number, '')) LIKE $${params.length}
          OR LOWER(COALESCE(lt.accession_number, '')) LIKE $${params.length}
          OR LOWER(COALESCE(lt.test_name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(lt.id::text, '')) LIKE $${params.length})`,
      )
    }

    if (cursor?.after) {
      params.push(cursor.after)
      whereParts.push(`lt.ordered_at > $${params.length}`)
    }

    params.push(pageSize)

    const { rows } = await query(
      `
      SELECT
        lt.id AS study_id,
        TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
        p.patient_number,
        lt.test_name AS study_name,
        lt.status,
        lt.priority,
        d.name AS ordered_by,
        u.name AS assigned_radiologist,
        lt.accession_number,
        lt.ordered_at,
        lt.completed_at
      FROM lab_tests lt
      JOIN patients p ON p.id = lt.patient_id
      LEFT JOIN users u ON u.id = lt.assigned_radiologist_id
      LEFT JOIN users d ON d.id = lt.doctor_id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY lt.ordered_at ASC
      LIMIT $${params.length}
      `,
      params,
    )

    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].ordered_at } : undefined
    return { rows, nextCursor }
  }
}
