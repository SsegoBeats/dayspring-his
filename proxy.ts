import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
// Note: Avoid heavy JWT verification in proxy (edge runtime).

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const token = req.cookies.get("session")?.value || req.cookies.get("session_dev")?.value
  const protectedPrefixes = ["/appointments", "/billing", "/medical-history"]
  const requestId = req.headers.get("x-request-id") || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)

  if (protectedPrefixes.some((p) => url.pathname.startsWith(p))) {
    if (!token) {
      const res = NextResponse.redirect(new URL("/", url))
      res.headers.set("x-request-id", requestId)
      return res
    }
  }
  const res = NextResponse.next()
  res.headers.set("x-request-id", requestId)
  return res
}

export const config = { matcher: ["/((?!_next|api/public|public).*)"] }
