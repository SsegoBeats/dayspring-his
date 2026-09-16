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

export class ObstetricsDataset implements Dataset {
  name = "obstetrics"
  defaultColumns = [
    "visit_date",
    "patient_number",
    "patient_name",
    "gravida",
    "parity",
    "gestational_age_weeks",
    "edd",
    "fundal_height_cm",
    "fetal_heart_rate",
    "presentation",
    "notes",
    "recorded_by",
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
    const run = getQuery(ctx)
    const recordedBy = f.recordedByUserId ? ctx.userId : null
    const { rows } = await run(
      `
      SELECT 
        oa.visit_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        oa.gravida,
        oa.parity,
        oa.gestational_age_weeks,
        oa.edd,
        oa.fundal_height_cm,
        oa.fetal_heart_rate,
        oa.presentation,
        oa.notes,
        u.name AS recorded_by
      FROM obstetric_assessments oa
      JOIN patients p ON p.id = oa.patient_id
      LEFT JOIN users u ON u.id = oa.recorded_by
      WHERE ($1::timestamp IS NULL OR oa.visit_date >= $1)
        AND ($2::timestamp IS NULL OR oa.visit_date <= $2)
        AND ($3::timestamp IS NULL OR oa.visit_date > $3)
        AND ($5::uuid IS NULL OR oa.recorded_by = $5)
      ORDER BY oa.visit_date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, recordedBy],
    )
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].visit_date } : undefined
    return { rows, nextCursor }
  }
}

