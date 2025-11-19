import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export class DentalDataset implements Dataset {
  name = "dental"
  defaultColumns = [
    "visit_date",
    "patient_number",
    "patient_name",
    "diagnosis",
    "procedure_performed",
    "tooth_notes",
    "notes",
    "dentist_name",
  ]

  validateFilters(input: any) {
    return Filter.parse(input)
  }

  async queryPage(
    ctx: ExportContext,
    f: z.infer<typeof Filter>,
    cursor?: { after?: string },
    pageSize = 5000,
  ) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT 
        dr.visit_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        dr.diagnosis,
        dr.procedure_performed,
        COALESCE(dr.tooth_chart->>'notes', '') AS tooth_notes,
        dr.notes,
        u.name AS dentist_name
      FROM dental_records dr
      JOIN patients p ON p.id = dr.patient_id
      LEFT JOIN users u ON u.id = dr.dentist_id
      WHERE ($1::timestamp IS NULL OR dr.visit_date >= $1)
        AND ($2::timestamp IS NULL OR dr.visit_date <= $2)
        AND ($3::timestamp IS NULL OR dr.visit_date > $3)
      ORDER BY dr.visit_date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize],
    )
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].visit_date } : undefined
    return { rows, nextCursor }
  }
}

