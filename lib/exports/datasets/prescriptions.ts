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

export class PrescriptionsDataset implements Dataset {
  name = "prescriptions"
  defaultColumns = [
    "prescription_date",
    "patient_number",
    "patient_name",
    "doctor_name",
    "visit_type",
    "medications",
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
    const doctorId = f.recordedByUserId ? ctx.userId : null
    const run = getQuery(ctx)
    const { rows } = await run(
      `
      SELECT
        pr.created_at AS prescription_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        u.name AS doctor_name,
        pr.visit_type,
        (
          SELECT STRING_AGG(
            CONCAT(m->>'name', COALESCE(' (' || m->>'dosage' || ')', ''), COALESCE(' ' || m->>'frequency', ''), COALESCE(' for ' || m->>'duration', '')),
            '; '
          )
          FROM jsonb_array_elements(pr.medications) AS m
        ) AS medications
      FROM prescriptions pr
      JOIN patients p ON p.id = pr.patient_id
      LEFT JOIN users u ON u.id = pr.doctor_id
      WHERE ($1::timestamp IS NULL OR pr.created_at >= $1)
        AND ($2::timestamp IS NULL OR pr.created_at <= $2)
        AND ($3::timestamp IS NULL OR pr.created_at > $3)
        AND ($5::uuid IS NULL OR pr.doctor_id = $5)
      ORDER BY pr.created_at ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, doctorId],
    )
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].prescription_date } : undefined
    return { rows, nextCursor }
  }
}
