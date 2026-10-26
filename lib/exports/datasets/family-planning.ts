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

export class FamilyPlanningDataset implements Dataset {
  name = "family_planning"
  defaultColumns = [
    "encounter_date",
    "patient_number",
    "patient_name",
    "event_type",
    "method",
    "status",
    "reason",
    "removal_reason",
    "replacement_method",
    "is_postpartum",
    "postpartum_weeks",
    "next_review_date",
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
        fpe.encounter_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        fpe.event_type,
        fpe.method,
        fpe.status,
        fpe.reason,
        fpe.removal_reason,
        fpe.replacement_method,
        fpe.is_postpartum,
        fpe.postpartum_weeks,
        fpe.next_review_date,
        fpe.notes,
        u.name AS recorded_by_name
      FROM family_planning_events fpe
      JOIN patients p ON p.id = fpe.patient_id
      LEFT JOIN users u ON u.id = fpe.recorded_by
      WHERE ($1::timestamp IS NULL OR fpe.encounter_date >= $1)
        AND ($2::timestamp IS NULL OR fpe.encounter_date <= $2)
        AND ($3::timestamp IS NULL OR fpe.encounter_date > $3)
        AND ($5::uuid IS NULL OR fpe.recorded_by = $5)
      ORDER BY fpe.encounter_date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, recordedBy],
    )

    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].encounter_date } : undefined
    return { rows, nextCursor }
  }
}
