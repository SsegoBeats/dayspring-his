import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"
import { RADIOLOGY_MODALITIES } from "@/lib/radiology"

const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]).optional(),
})

export class RadiologyDataset implements Dataset {
  name = "radiology"
  defaultColumns = [
    "study_id",
    "ordered_at",
    "status",
    "priority",
    "patient_name",
    "patient_number",
    "test_name",
    "ordered_by",
    "radiologist",
  ]

  validateFilters(input: unknown) {
    return Filter.parse(input)
  }

  async queryPage(
    _ctx: ExportContext,
    f: z.infer<typeof Filter>,
    cursor?: { after?: string; id?: string },
    pageSize = 5000,
  ) {
    const params: any[] = [
      f.from,
      f.to,
      f.status ? f.status.toLowerCase() : null,
      cursor?.after ?? null,
      cursor?.id ?? null,
      pageSize,
      RADIOLOGY_MODALITIES,
    ]

    const { rows } = await query(
      `
      SELECT lt.id AS study_id,
             lt.ordered_at,
             lt.status,
             lt.priority,
             CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) AS patient_name,
             p.patient_number,
             COALESCE(NULLIF(lt.test_name, ''), lt.test_type) AS test_name,
             d.name AS ordered_by,
             u.name AS radiologist
      FROM lab_tests lt
      LEFT JOIN patients p ON p.id = lt.patient_id
      LEFT JOIN users d ON d.id = lt.doctor_id
      LEFT JOIN users u ON u.id = lt.assigned_radiologist_id
      WHERE LOWER(COALESCE(NULLIF(lt.test_name, ''), lt.test_type)) = ANY($7::text[])
        AND lt.ordered_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR LOWER(lt.status) = $3)
        AND (
          $4::timestamp IS NULL
          OR lt.ordered_at > $4
          OR (lt.ordered_at = $4 AND lt.id > COALESCE($5::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
        )
      ORDER BY lt.ordered_at ASC, lt.id ASC
      LIMIT $6
      `,
      params,
    )

    const nextCursor =
      rows.length === pageSize
        ? {
            after: rows[rows.length - 1].ordered_at,
            id: rows[rows.length - 1].study_id,
          }
        : undefined

    return { rows, nextCursor }
  }
}
