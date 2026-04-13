import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await query(
      `SELECT id, name, description FROM medication_categories ORDER BY name ASC`,
      [],
    )
    return NextResponse.json({ categories: rows })
  } catch (err: any) {
    // If table doesn't exist yet, return default categories
    const defaultCategories = [
      { id: "1", name: "Antimalarials", description: "Medications used to prevent and treat malaria" },
      { id: "2", name: "Antidepressants", description: "Medications used to treat depression and mood disorders" },
      { id: "3", name: "Anticoagulants", description: "Medications that prevent blood clotting" },
      { id: "4", name: "Antibiotics", description: "Medications used to treat bacterial infections" },
      { id: "5", name: "Antivirals", description: "Medications used to treat viral infections" },
      { id: "6", name: "Antifungals", description: "Medications used to treat fungal infections" },
      { id: "7", name: "Analgesics", description: "Pain relief medications" },
      { id: "8", name: "Antipyretics", description: "Fever-reducing medications" },
      { id: "9", name: "Antihypertensives", description: "Medications for high blood pressure" },
      { id: "10", name: "Antidiabetics", description: "Medications for diabetes management" },
      { id: "11", name: "Cardiovascular", description: "Heart and blood vessel medications" },
      { id: "12", name: "Respiratory", description: "Medications for respiratory conditions" },
      { id: "13", name: "Gastrointestinal", description: "Medications for digestive system" },
      { id: "14", name: "Neurological", description: "Medications for nervous system disorders" },
      { id: "15", name: "Hormonal", description: "Hormone-related medications" },
      { id: "16", name: "Vitamins & Supplements", description: "Vitamins and nutritional supplements" },
      { id: "17", name: "Vaccines", description: "Immunization vaccines" },
      { id: "18", name: "Antiseptics & Disinfectants", description: "Cleaning and sterilization agents" },
      { id: "19", name: "Topical", description: "Medications applied to skin" },
      { id: "20", name: "Ophthalmic", description: "Eye medications" },
      { id: "21", name: "Ear Medications", description: "Ear drops and treatments" },
      { id: "22", name: "Other", description: "Other medications not categorized above" },
    ]
    return NextResponse.json({ categories: defaultCategories })
  }
}
