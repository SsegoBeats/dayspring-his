import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

function getQuery(ctx: ExportContext) {
  return ctx.runQuery ?? ((text: string, params?: any[]) => query(text, params))
}

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  recordedByUserId: z.boolean().optional(),
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
    cursor?: { after_date?: string; after_id?: string },
    pageSize = 5000,
  ) {
    const after_date = cursor?.after_date ?? null
    const after_id = cursor?.after_id ?? null
    const run = getQuery(ctx)
    const dentistId = f.recordedByUserId ? ctx.userId : null
    const { rows } = await run(
      `
      SELECT
        dr.id,
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
        AND (
          $3::timestamp IS NULL
          OR dr.visit_date > $3::timestamp
          OR (dr.visit_date = $3::timestamp AND dr.id > $4::uuid)
        )
        AND ($6::uuid IS NULL OR dr.dentist_id = $6)
      ORDER BY dr.visit_date ASC, dr.id ASC
      LIMIT $5
      `,
      [f.from ?? null, f.to ?? null, after_date, after_id, pageSize, dentistId],
    )
    const nextCursor =
      rows.length === pageSize
        ? { after_date: rows[rows.length - 1].visit_date, after_id: rows[rows.length - 1].id }
        : undefined
    return { rows, nextCursor }
  }
}

