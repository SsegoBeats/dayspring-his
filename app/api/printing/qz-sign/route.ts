import { NextResponse } from "next/server"
import * as crypto from "crypto"
import fs from "fs"
import path from "path"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"

// Ensure Node.js runtime (fs/crypto not available on Edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Roles that are permitted to drive the QZ Tray print signing flow.
// Any role that may print receipts, labels, or reports should be included.
const PRINT_ALLOWED_ROLES = new Set([
  "Hospital Admin",
  "Receptionist",
  "Cashier",
  "Nurse",
  "Clinician",
  "Pharmacist",
  "Lab Tech",
  "Radiologist",
  "Midwife",
  "Dentist",
])

async function requirePrintRole() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return null
  if (!PRINT_ALLOWED_ROLES.has(auth.role)) return null
  return auth
}

export async function GET(req: Request) {
  const auth = await requirePrintRole()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const url = new URL(req.url)
  const mode = url.searchParams.get("mode")
  if (mode === "cert") {
    try {
      let cert = process.env.QZ_PUBLIC_CERT || ""
      if (!cert) {
        const file = process.env.QZ_PUBLIC_CERT_FILE
        if (file) {
          const p = path.resolve(process.cwd(), file)
          cert = fs.readFileSync(p, "utf8")
        }
      }
      cert = cert.trim()
      if (!cert) return NextResponse.json({ error: "Missing QZ_PUBLIC_CERT or QZ_PUBLIC_CERT_FILE" }, { status: 500 })
      return new NextResponse(cert, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      })
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to load cert: ${e?.message || e}` }, { status: 500 })
    }
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 })
}

export async function POST(req: Request) {
  const auth = await requirePrintRole()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { toSign } = await req.json()
    if (!toSign || typeof toSign !== "string") {
      return NextResponse.json({ error: "toSign required" }, { status: 400 })
    }
    let priv = process.env.QZ_PRIVATE_KEY || ""
    if (!priv) {
      const file = process.env.QZ_PRIVATE_KEY_FILE
      if (file) {
        const p = path.resolve(process.cwd(), file)
        priv = fs.readFileSync(p, "utf8")
      }
    }
    priv = priv.trim()
    if (!priv) return NextResponse.json({ error: "Missing QZ_PRIVATE_KEY or QZ_PRIVATE_KEY_FILE" }, { status: 500 })
    try {
      const signer = crypto.createSign("RSA-SHA256")
      signer.update(toSign)
      signer.end()
      const signature = signer.sign(priv, "base64")
      return NextResponse.json({ signature })
    } catch (e: any) {
      return NextResponse.json({ error: `Signing error: ${e?.message || e}` }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Signing failed" }, { status: 500 })
  }
}
