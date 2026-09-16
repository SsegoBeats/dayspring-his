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

export class LaborDataset implements Dataset {
  name = "labor"
  defaultColumns = [
    "admission_date",
    "delivery_date",
    "patient_number",
    "patient_name",
    "onset_of_labor",
    "delivery_type",
    "duration_of_labor_hours",
    "presentation",
    "blood_loss_ml",
    "complications",
    "baby_sex",
    "baby_birth_weight_g",
    "baby_apgar_1min",
    "baby_apgar_5min",
    "baby_condition",
    "midwife_name",
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
        lr.admission_date,
        lr.delivery_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        lr.onset_of_labor,
        lr.delivery_type,
        lr.duration_of_labor_hours,
        lr.presentation,
        lr.rupture_of_membranes,
        lr.placenta_delivery,
        lr.blood_loss_ml,
        lr.complications,
        lr.notes,
        lr.baby_sex,
        lr.baby_birth_weight_g,
        lr.baby_apgar_1min,
        lr.baby_apgar_5min,
        lr.baby_condition,
        lr.baby_notes,
        u.name AS midwife_name
      FROM labor_delivery_records lr
      JOIN patients p ON p.id = lr.patient_id
      LEFT JOIN users u ON u.id = lr.midwife_id
      WHERE ($1::timestamp IS NULL OR lr.admission_date >= $1)
        AND ($2::timestamp IS NULL OR lr.admission_date <= $2)
        AND ($3::timestamp IS NULL OR lr.admission_date > $3)
        AND ($5::uuid IS NULL OR lr.midwife_id = $5)
      ORDER BY lr.admission_date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, recordedBy],
    )

    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].admission_date } : undefined
    return { rows, nextCursor }
  }
}
