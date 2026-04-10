import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"

export async function GET() {
  const token = crypto.randomBytes(24).toString("hex")
  const res = NextResponse.json({ token })
  // Double-submit cookie (not httpOnly so the browser can include header if needed)
  res.cookies.set("csrfToken", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours — persists across page refreshes
  })
  return res
}


