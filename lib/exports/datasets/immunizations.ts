import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

function getQuery(ctx: ExportContext) {
  return ctx.runQuery ?? ((text: string, params?: any[]) => query(text, params))
}

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  patientId: z.string().uuid().optional(),
  recordedByUserId: z.boolean().optional(),
  status: z.enum(["Due", "Given", "Overdue", "Not Given", "Contraindicated", "Refused"]).optional(),
})

export class ImmunizationsDataset implements Dataset {
  name = "immunizations"
  defaultColumns = [
    "date_administered",
    "patient_number",
    "patient_name",
    "vaccine_name",
    "age_time",
    "dose",
    "status",
    "next_due_date",
    "overdue_date",
    "administered_by",
    "batch_number",
    "manufacturer",
    "notes",
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
    const recordedBy = f.recordedByUserId ? ctx.userId : null
    const run = getQuery(ctx)
    const { rows } = await run(
      `
      SELECT
        pi.date_administered,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        pi.vaccine_name,
        pi.age_time,
        pi.dose,
        pi.status,
        pi.next_due_date,
        pi.overdue_date,
        pi.administered_by,
        pi.batch_number,
        pi.manufacturer,
        pi.notes
      FROM patient_immunizations pi
      JOIN patients p ON p.id = pi.patient_id
      WHERE ($1::timestamp IS NULL OR pi.date_administered >= $1)
        AND ($2::timestamp IS NULL OR pi.date_administered <= $2)
        AND ($3::date IS NULL OR pi.date_administered > $3)
        AND ($5::uuid IS NULL OR pi.recorded_by = $5)
        AND ($6::text IS NULL OR pi.status = $6)
        AND ($7::uuid IS NULL OR pi.patient_id = $7)
      ORDER BY pi.date_administered ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, recordedBy, f.status ?? null, f.patientId ?? null],
    )

    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].date_administered } : undefined
    return { rows, nextCursor }
  }
}
