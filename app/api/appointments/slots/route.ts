import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

const Q = z.object({ doctorId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

export async function GET(req: Request) {
  try {
    const token = cookies().get("session")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "appointments", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const doctorId = url.searchParams.get("doctorId") || ""
    const date = url.searchParams.get("date") || ""
    Q.parse({ doctorId, date })

    const day = new Date(date).getDay()

    const { rows: schedRows } = await query(
      `SELECT start_time, end_time, slot_duration, max_patients_per_slot FROM doctor_schedules WHERE doctor_id = $1 AND day_of_week = $2`,
      [doctorId, day],
    )
    if (schedRows.length === 0) return NextResponse.json({ slots: [] })
    const schedule = schedRows[0]

    const { rows: booked } = await query(
      `SELECT appointment_time, COUNT(1) as cnt FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status <> 'Cancelled' GROUP BY appointment_time`,
      [doctorId, date],
    )
    const bookedMap = new Map<string, number>(booked.map((b: any) => [String(b.appointment_time).slice(0, 5), Number(b.cnt)]))

    const slots: { time: string; capacity: number; available: number }[] = []
    const [sh, sm] = String(schedule.start_time).split(":").map(Number)
    const [eh, em] = String(schedule.end_time).split(":").map(Number)
    let cur = sh * 60 + sm
    const end = eh * 60 + em
    const step = Number(schedule.slot_duration)
    const cap = Number(schedule.max_patients_per_slot)
    while (cur < end) {
      const h = Math.floor(cur / 60)
      const m = cur % 60
      const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      const used = bookedMap.get(label) || 0
      const available = Math.max(0, cap - used)
      if (available > 0) slots.push({ time: label, capacity: cap, available })
      cur += step
    }
    return NextResponse.json({ slots })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to compute slots" }, { status: 500 })
  }
}


