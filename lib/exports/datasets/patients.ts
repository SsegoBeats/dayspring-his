import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export class PatientsDataset implements Dataset {
  name = "patients"
  defaultColumns = [
    "patient_number", "first_name", "last_name", "date_of_birth", "age_years", "gender", "phone",
    "address", "nin", "district", "subcounty", "parish", "village", "occupation", "blood_group",
    "next_of_kin_first_name", "next_of_kin_last_name", "next_of_kin_country", "next_of_kin_phone", "next_of_kin_relation", "next_of_kin_residence",
    "insurance_provider", "insurance_member_no"
  ]
  validateFilters(input: any) { return Filter.parse(input) }
  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    // Export only demographic data - exclude triage/OPD information
    const { rows } = await query(
      `
      SELECT 
        patient_number, 
        first_name, 
        last_name, 
        date_of_birth, 
        age_years,
        gender, 
        phone, 
        address, 
        nin, 
        district, 
        subcounty, 
        parish, 
        village, 
        occupation, 
        blood_group,
        next_of_kin_first_name,
        next_of_kin_last_name,
        next_of_kin_country,
        next_of_kin_phone, 
        COALESCE(next_of_kin_relation, '') as next_of_kin_relation,
        COALESCE(next_of_kin_residence, '') as next_of_kin_residence,
        insurance_provider, 
        insurance_member_no,
        created_at
      FROM patients
      WHERE ($1::timestamp IS NULL OR created_at >= $1)
        AND ($2::timestamp IS NULL OR created_at <= $2)
        AND ($3::timestamp IS NULL OR created_at > $3)
      ORDER BY created_at ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: rows[rows.length - 1].created_at } : undefined
    return { rows, nextCursor }
  }
}


