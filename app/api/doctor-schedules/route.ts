import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET() {
  const token = cookies().get("session")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "appointments", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { rows } = await query(
    `SELECT ds.id, ds.doctor_id, u.name AS doctor_name, ds.day_of_week, ds.start_time, ds.end_time, ds.slot_duration, ds.max_patients_per_slot
     FROM doctor_schedules ds JOIN users u ON u.id = ds.doctor_id ORDER BY u.name, ds.day_of_week`,
  )
  return NextResponse.json({ schedules: rows })
}

const CreateSchema = z.object({
  doctorId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDuration: z.number().int().min(10).max(60),
  maxPatientsPerSlot: z.number().int().min(1).max(10),
})

export async function POST(req: Request) {
  const token = cookies().get("session")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "appointments", "update")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const data = CreateSchema.parse(body)
  await query(
    `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration, max_patients_per_slot)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (doctor_id, day_of_week) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, slot_duration = EXCLUDED.slot_duration, max_patients_per_slot = EXCLUDED.max_patients_per_slot`,
    [data.doctorId, data.dayOfWeek, data.startTime, data.endTime, data.slotDuration, data.maxPatientsPerSlot],
  )
  return NextResponse.json({ success: true })
}


