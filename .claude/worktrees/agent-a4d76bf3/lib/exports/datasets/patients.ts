import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  gender: z.string().optional(),
  status: z.string().optional(),
  triage: z.string().optional(),
  minAge: z.coerce.number().int().min(0).max(130).optional(),
  maxAge: z.coerce.number().int().min(0).max(130).optional(),
})

export class PatientsDataset implements Dataset {
  name = "patients"
  defaultColumns = [
    "patient_number",
    "first_name",
    "last_name",
    "date_of_birth",
    "age_years",
    "gender",
    "phone",
    "address",
    "nin",
    "district",
    "subcounty",
    "parish",
    "village",
    "occupation",
    "blood_group",
    "next_of_kin_first_name",
    "next_of_kin_last_name",
    "next_of_kin_country",
    "next_of_kin_phone",
    "next_of_kin_relation",
    "next_of_kin_residence",
    "insurance_provider",
    "insurance_member_no",
  ]

  validateFilters(input: any) {
    return Filter.parse(input || {})
  }

  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const params: any[] = []
    const whereParts: string[] = []
    let idx = 1

    if (f.from) {
      whereParts.push(`p.created_at >= $${idx}`)
      params.push(f.from)
      idx++
    }
    if (f.to) {
      whereParts.push(`p.created_at <= $${idx}`)
      params.push(f.to)
      idx++
    }
    if (f.search) {
      whereParts.push(`(
        p.first_name ILIKE $${idx}
        OR p.last_name ILIKE $${idx}
        OR p.patient_number ILIKE $${idx}
        OR p.phone ILIKE $${idx}
        OR COALESCE(p.next_of_kin_name, '') ILIKE $${idx}
        OR COALESCE(p.next_of_kin_first_name, '') ILIKE $${idx}
        OR COALESCE(p.next_of_kin_last_name, '') ILIKE $${idx}
      )`)
      params.push(`%${f.search}%`)
      idx++
    }
    if (f.gender) {
      whereParts.push(`p.gender ILIKE $${idx}`)
      params.push(f.gender)
      idx++
    }
    if (f.status) {
      whereParts.push(`(p.current_status ILIKE $${idx} OR ($${idx} = 'registered' AND p.current_status IS NULL))`)
      params.push(f.status)
      idx++
    }
    if (f.triage) {
      whereParts.push(`t.category ILIKE $${idx}`)
      params.push(f.triage)
      idx++
    }
    if (typeof f.minAge === "number") {
      whereParts.push(`COALESCE(p.age_years, EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth::date))::int) >= $${idx}`)
      params.push(f.minAge)
      idx++
    }
    if (typeof f.maxAge === "number") {
      whereParts.push(`COALESCE(p.age_years, EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth::date))::int) <= $${idx}`)
      params.push(f.maxAge)
      idx++
    }
    if (after) {
      whereParts.push(`p.created_at > $${idx}`)
      params.push(after)
      idx++
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""
    const { rows } = await query(
      `
      SELECT
        p.patient_number,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.age_years,
        p.gender,
        p.phone,
        p.address,
        p.nin,
        p.district,
        p.subcounty,
        p.parish,
        p.village,
        p.occupation,
        p.blood_group,
        p.next_of_kin_first_name,
        p.next_of_kin_last_name,
        p.next_of_kin_country,
        p.next_of_kin_phone,
        COALESCE(p.next_of_kin_relation, '') AS next_of_kin_relation,
        COALESCE(p.next_of_kin_residence, '') AS next_of_kin_residence,
        p.insurance_provider,
        p.insurance_member_no,
        p.created_at
      FROM patients p
      LEFT JOIN LATERAL (
        SELECT category
        FROM triage_assessments
        WHERE patient_id = p.id
        ORDER BY COALESCE(recorded_at, created_at) DESC
        LIMIT 1
      ) t ON true
      ${whereSql}
      ORDER BY p.created_at ASC
      LIMIT $${idx}
      `,
      [...params, pageSize],
    )

    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].created_at } : undefined
    return { rows, nextCursor }
  }
}
