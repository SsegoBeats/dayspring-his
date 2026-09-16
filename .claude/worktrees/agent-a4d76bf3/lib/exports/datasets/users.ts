import { z } from "zod"
import { query } from "@/lib/db"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

const VALID_ROLES = [
  "Receptionist",
  "Clinician",
  "Radiologist",
  "Nurse",
  "Lab Tech",
  "Hospital Admin",
  "Cashier",
  "Pharmacist",
  "Midwife",
  "Dentist",
] as const

const Filter = z.object({
  search: z.string().optional(),
  role: z.enum(VALID_ROLES).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  sortBy: z.enum(["name", "email", "role", "status", "createdAt", "lastLogin"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

const SORT_MAP: Record<NonNullable<z.infer<typeof Filter>["sortBy"]>, string> = {
  name: "u.name",
  email: "u.email",
  role: "u.role",
  status: "u.is_active",
  createdAt: "u.created_at",
  lastLogin: "u.last_login",
}

export class UsersDataset implements Dataset {
  name = "users"
  defaultColumns = ["name", "email", "role", "status", "created_at", "last_login", "email_verified"]

  validateFilters(input: any) {
    return Filter.parse(input || {})
  }

  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>) {
    const conditions: string[] = []
    const params: any[] = []
    let idx = 1

    if (f.search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.role ILIKE $${idx})`)
      params.push(`%${f.search}%`)
      idx++
    }
    if (f.role) {
      conditions.push(`u.role = $${idx}`)
      params.push(f.role)
      idx++
    }
    if (f.status) {
      conditions.push(`u.is_active = $${idx}`)
      params.push(f.status === "active")
      idx++
    }
    if (f.createdAfter) {
      conditions.push(`u.created_at >= $${idx}`)
      params.push(f.createdAfter)
      idx++
    }
    if (f.createdBefore) {
      conditions.push(`u.created_at <= $${idx}`)
      params.push(f.createdBefore)
      idx++
    }

    const orderCol = SORT_MAP[f.sortBy || "createdAt"] || "u.created_at"
    const orderDir = f.sortOrder === "asc" ? "ASC" : "DESC"
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows } = await query(
      `
      SELECT
        u.name,
        u.email,
        u.role,
        CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END AS status,
        u.created_at,
        u.last_login,
        (u.email_verified_at IS NOT NULL) AS email_verified
      FROM users u
      ${where}
      ORDER BY ${orderCol} ${orderDir}, u.id ASC
      LIMIT $${idx}
      `,
      [...params, 20000],
    )

    return { rows }
  }
}
