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

export class PostnatalDataset implements Dataset {
  name = "postnatal"
  defaultColumns = [
    "visit_date",
    "days_postpartum",
    "patient_number",
    "patient_name",
    "bp_systolic",
    "bp_diastolic",
    "temperature_c",
    "pulse_rate",
    "respiratory_rate",
    "weight_kg",
    "general_assessment",
    "other_observations",
    "lochia",
    "wound_healing",
    "nutrition_assessment",
    "mother_nutrition_status",
    "nutrition_intake",
    "nutrition_food_access",
    "nutrition_supplements",
    "nutrition_counselling",
    "breastfeeding_status",
    "newborn_feeding_status",
    "cord_status",
    "cord_assessment",
    "cord_care_provided",
    "cord_advice",
    "cord_concerns",
    "cord_follow_up",
    "baby_weight_g",
    "baby_condition",
    "newborn_patient_number",
    "newborn_patient_name",
    "lab_investigations",
    "notes",
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
        pv.visit_date,
        pv.days_postpartum,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        pv.bp_systolic,
        pv.bp_diastolic,
        pv.temperature_c,
        pv.pulse_rate,
        pv.respiratory_rate,
        pv.weight_kg,
        pv.general_assessment,
        pv.other_observations,
        pv.lochia,
        pv.wound_healing,
        pv.nutrition_assessment,
        pv.mother_nutrition_status,
        pv.nutrition_intake,
        pv.nutrition_food_access,
        pv.nutrition_supplements,
        pv.nutrition_counselling,
        pv.breastfeeding_status,
        pv.newborn_feeding_status,
        pv.cord_status,
        pv.cord_assessment,
        pv.cord_care_provided,
        pv.cord_advice,
        pv.cord_concerns,
        pv.cord_follow_up,
        pv.baby_weight_g,
        pv.baby_condition,
        np.patient_number AS newborn_patient_number,
        CONCAT(np.first_name, ' ', np.last_name) AS newborn_patient_name,
        (
          SELECT STRING_AGG(CONCAT(lt.test_name, ' [', lt.status, ']'), '; ' ORDER BY lt.ordered_at)
          FROM lab_tests lt
          WHERE lt.postnatal_visit_id = pv.id
        ) AS lab_investigations,
        pv.notes,
        u.name AS midwife_name
      FROM postnatal_visits pv
      JOIN patients p ON p.id = pv.patient_id
      LEFT JOIN patients np ON np.id = pv.newborn_id
      LEFT JOIN users u ON u.id = pv.midwife_id
      WHERE ($1::timestamp IS NULL OR pv.visit_date >= $1)
        AND ($2::timestamp IS NULL OR pv.visit_date <= $2)
        AND ($3::timestamp IS NULL OR pv.visit_date > $3)
        AND ($5::uuid IS NULL OR pv.midwife_id = $5)
      ORDER BY pv.visit_date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, recordedBy],
    )

    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].visit_date } : undefined
    return { rows, nextCursor }
  }
}
