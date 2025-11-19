import { NextResponse } from "next/server"
import crypto from "crypto"
import fs from "fs"
import path from "path"

// Ensure Node.js runtime (fs/crypto not available on Edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
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
      return new NextResponse(cert, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to load cert: ${e?.message || e}` }, { status: 500 })
    }
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 })
}

export async function POST(req: Request) {
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
