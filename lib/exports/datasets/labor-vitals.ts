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

export class LaborVitalEventsDataset implements Dataset {
  name = "labor_vital_events"
  defaultColumns = [
    "measured_at",
    "patient_number",
    "patient_name",
    "admission_date",
    "delivery_date",
    "delivery_type",
    "bp_systolic",
    "bp_diastolic",
    "pulse_rate",
    "respiratory_rate",
    "temperature_c",
    "fetal_heart_rate",
    "contractions_per_10min",
    "cervical_dilation_cm",
    "oxygen_saturation",
    "urine_output_ml",
    "maternal_weight_kg",
    "notes",
    "recorded_by_name",
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
        lve.measured_at,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        lr.admission_date,
        lr.delivery_date,
        lr.delivery_type,
        lve.bp_systolic,
        lve.bp_diastolic,
        lve.pulse_rate,
        lve.respiratory_rate,
        lve.temperature_c,
        lve.fetal_heart_rate,
        lve.contractions_per_10min,
        lve.cervical_dilation_cm,
        lve.oxygen_saturation,
        lve.urine_output_ml,
        lve.maternal_weight_kg,
        lve.notes,
        u.name AS recorded_by_name
      FROM labor_vital_events lve
      JOIN patients p ON p.id = lve.patient_id
      LEFT JOIN labor_delivery_records lr ON lr.id = lve.labor_delivery_id
      LEFT JOIN users u ON u.id = lve.recorded_by
      WHERE ($1::timestamp IS NULL OR lve.measured_at >= $1)
        AND ($2::timestamp IS NULL OR lve.measured_at <= $2)
        AND ($3::timestamp IS NULL OR lve.measured_at > $3)
        AND ($5::uuid IS NULL OR lve.recorded_by = $5)
      ORDER BY lve.measured_at ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, recordedBy],
    )

    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].measured_at } : undefined
    return { rows, nextCursor }
  }
}
