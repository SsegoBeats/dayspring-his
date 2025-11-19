import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { sendSms } from "@/lib/sms"

const Schema = z.object({ to: z.string().min(8), message: z.string().min(1).max(480) })

export async function POST(req: Request) {
  const token = cookies().get("session")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "patients", "update")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { to, message } = Schema.parse(await req.json())
  const result = await sendSms(to, message)
  return NextResponse.json(result)
}


