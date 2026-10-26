import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { query, withClient } from "@/lib/db"
import { can, verifyToken } from "@/lib/security"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ConfigurationSchema = z.object({
  categories: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    specimens: z.array(z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(100),
      loincCodes: z.array(z.string().trim().min(1).max(20)).max(1000),
    })).max(200),
  })).min(1).max(50),
})

async function getAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  return token ? verifyToken(token) : null
}

export async function GET() {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "lab", "read") && !can(auth.role, "medical", "create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { rows } = await query<{
      category_id: string
      category_name: string
      specimen_id: string | null
      specimen_name: string | null
      loinc_code: string | null
      test_name: string | null
      component: string | null
      property: string | null
      system: string | null
      test_class: string | null
    }>(
      `SELECT c.id AS category_id, c.name AS category_name,
              s.id AS specimen_id, s.name AS specimen_name,
              l.loinc_code, COALESCE(l.long_common_name, l.shortname, l.loinc_code) AS test_name,
              l.component, l.property, l.system, l.class AS test_class
         FROM lab_specimen_categories c
         LEFT JOIN lab_specimens s ON s.category_id = c.id
         LEFT JOIN lab_specimen_tests st ON st.specimen_id = s.id
         LEFT JOIN loinc_tests l ON l.loinc_code = st.loinc_code
        ORDER BY c.display_order, c.name, s.display_order, s.name, test_name`,
    )

    const categories = new Map<string, {
      id: string
      name: string
      specimens: Map<string, {
        id: string
        name: string
        tests: Array<{ loincCode: string; name: string; component: string | null; property: string | null; system: string | null; class: string | null }>
      }>
    }>()

    for (const row of rows) {
      let category = categories.get(row.category_id)
      if (!category) {
        category = { id: row.category_id, name: row.category_name, specimens: new Map() }
        categories.set(row.category_id, category)
      }
      if (!row.specimen_id || !row.specimen_name) continue
      let specimen = category.specimens.get(row.specimen_id)
      if (!specimen) {
        specimen = { id: row.specimen_id, name: row.specimen_name, tests: [] }
        category.specimens.set(row.specimen_id, specimen)
      }
      if (row.loinc_code && row.test_name) {
        specimen.tests.push({
          loincCode: row.loinc_code,
          name: row.test_name,
          component: row.component,
          property: row.property,
          system: row.system,
          class: row.test_class,
        })
      }
    }

    return NextResponse.json({
      categories: Array.from(categories.values()).map((category) => ({
        ...category,
        specimens: Array.from(category.specimens.values()),
      })),
    })
  } catch (error) {
    console.error("Error loading lab specimen catalog:", error)
    return NextResponse.json({ error: "Failed to load specimen catalog" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin" && auth.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = ConfigurationSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid specimen catalog", details: parsed.error.flatten() }, { status: 400 })
    }

    const categories = parsed.data.categories.map((category) => ({
      id: category.id || randomUUID(),
      name: category.name,
      specimens: category.specimens.map((specimen) => ({
        id: specimen.id || randomUUID(),
        name: specimen.name,
        loincCodes: Array.from(new Set(specimen.loincCodes)),
      })),
    }))
    const categoryNames = categories.map((category) => category.name.toLocaleLowerCase())
    const specimens = categories.flatMap((category, categoryIndex) =>
      category.specimens.map((specimen) => ({ ...specimen, categoryId: categories[categoryIndex].id })),
    )
    const specimenNames = specimens.map((specimen) => specimen.name.toLocaleLowerCase())
    const ids = [
      ...categories.map((category) => category.id),
      ...specimens.map((specimen) => specimen.id),
    ]
    const codes = Array.from(new Set(specimens.flatMap((specimen) => specimen.loincCodes)))

    if (specimens.length > 500 || codes.length > 5000) {
      return NextResponse.json({ error: "Specimen catalog exceeds supported size" }, { status: 400 })
    }
    if (new Set(categoryNames).size !== categoryNames.length || new Set(specimenNames).size !== specimenNames.length) {
      return NextResponse.json({ error: "Category and specimen names must be unique" }, { status: 400 })
    }
    if (new Set(ids).size !== ids.length || ids.some((id) => !UUID_RE.test(id))) {
      return NextResponse.json({ error: "Category and specimen identifiers must be unique" }, { status: 400 })
    }
    if (specimens.length === 0) {
      return NextResponse.json({ error: "At least one specimen is required" }, { status: 400 })
    }

    if (codes.length) {
      const { rows: knownTests } = await query<{ loinc_code: string }>(
        "SELECT loinc_code FROM loinc_tests WHERE loinc_code = ANY($1::varchar[])",
        [codes],
      )
      const knownCodes = new Set(knownTests.map((test) => test.loinc_code))
      const unknownCodes = codes.filter((code) => !knownCodes.has(code))
      if (unknownCodes.length) {
        return NextResponse.json({ error: "Some test codes are not in the LOINC catalog", unknownCodes }, { status: 400 })
      }
    }

    await withClient(async (client) => {
      await client.query("BEGIN")
      try {
        for (const [displayOrder, category] of categories.entries()) {
          await client.query(
            `INSERT INTO lab_specimen_categories (id, name, display_order)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_order = EXCLUDED.display_order`,
            [category.id, category.name, displayOrder],
          )
        }
        for (const [displayOrder, specimen] of specimens.entries()) {
          await client.query(
            `INSERT INTO lab_specimens (id, category_id, name, display_order)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE
               SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, display_order = EXCLUDED.display_order`,
            [specimen.id, specimen.categoryId, specimen.name, displayOrder],
          )
        }

        await client.query("DELETE FROM lab_specimen_tests")
        await client.query("DELETE FROM lab_specimens WHERE id <> ALL($1::uuid[])", [specimens.map((specimen) => specimen.id)])
        await client.query("DELETE FROM lab_specimen_categories WHERE id <> ALL($1::uuid[])", [categories.map((category) => category.id)])

        const mappings = specimens.flatMap((specimen) =>
          specimen.loincCodes.map((loincCode) => ({ specimenId: specimen.id, loincCode })),
        )
        if (mappings.length) {
          const values: string[] = []
          const params: string[] = []
          mappings.forEach((mapping, index) => {
            const offset = index * 2
            values.push(`($${offset + 1}, $${offset + 2})`)
            params.push(mapping.specimenId, mapping.loincCode)
          })
          await client.query(
            `INSERT INTO lab_specimen_tests (specimen_id, loinc_code) VALUES ${values.join(", ")}`,
            params,
          )
        }
        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving lab specimen catalog:", error)
    return NextResponse.json({ error: "Failed to save specimen catalog" }, { status: 500 })
  }
}
