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

export class MedicalRecordsDataset implements Dataset {
  name = "medical_records"
  defaultColumns = [
    "record_date",
    "patient_number",
    "patient_name",
    "doctor_name",
    "diagnosis",
    "symptoms",
    "treatment",
    "bp",
    "temperature",
    "heart_rate",
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
    const doctorId = f.recordedByUserId ? ctx.userId : null
    const run = getQuery(ctx)
    const { rows } = await run(
      `
      SELECT
        mr.date AS record_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        u.name AS doctor_name,
        mr.diagnosis,
        mr.symptoms,
        mr.treatment,
        mr.vital_signs->>'bloodPressure' AS bp,
        mr.vital_signs->>'temperature' AS temperature,
        mr.vital_signs->>'heartRate' AS heart_rate,
        mr.notes
      FROM medical_records mr
      JOIN patients p ON p.id = mr.patient_id
      LEFT JOIN users u ON u.id = mr.doctor_id
      WHERE ($1::timestamp IS NULL OR mr.date >= $1)
        AND ($2::timestamp IS NULL OR mr.date <= $2)
        AND ($3::timestamp IS NULL OR mr.date > $3)
        AND ($5::uuid IS NULL OR mr.doctor_id = $5)
      ORDER BY mr.date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, doctorId],
    )
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].record_date } : undefined
    return { rows, nextCursor }
  }
}
