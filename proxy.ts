import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ─── CSRF protection (double-submit cookie pattern) ───────────────────────────
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const CSRF_EXEMPT_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/csrf",
  "/api/pesapal/ipn",
  "/api/jobs/run",
  "/api/cron/",
  "/api/heartbeat",
  "/api/openapi",
]

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname

  // Skip static files — let Next.js handle them directly
  const staticExtensions = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".css", ".js", ".json",
    ".xml", ".pdf", ".txt", ".webmanifest",
  ]
  if (staticExtensions.some((ext) => pathname.endsWith(ext)) || pathname === "/sw.js") {
    return NextResponse.next()
  }

  const requestId =
    req.headers.get("x-request-id") ||
    (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)

  // ── CSRF enforcement for /api/ mutation routes ────────────────────────────
  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method) && !isCsrfExempt(pathname)) {
    const headerToken = req.headers.get("x-csrf-token")
    const cookieToken = req.cookies.get("csrfToken")?.value

    if (!headerToken || !cookieToken) {
      return NextResponse.json(
        { error: "CSRF token missing. Fetch /api/csrf to obtain a token and include it as x-csrf-token." },
        { status: 403 },
      )
    }

    // Constant-time comparison to prevent timing attacks.
    const hBuf = Buffer.from(headerToken, "utf8")
    const cBuf = Buffer.from(cookieToken, "utf8")
    const valid = hBuf.length === cBuf.length && hBuf.every((b, i) => b === cBuf[i])

    if (!valid) {
      return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 })
    }
  }

  // ── Protected page routes (redirect unauthenticated users) ────────────────
  const token = req.cookies.get("session")?.value || req.cookies.get("session_dev")?.value
  const protectedPrefixes = ["/appointments", "/billing", "/medical-history"]

  if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
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

export const config = {
  matcher: [
    "/((?!_next|api/public).*)",
    "/api/:path*",
  ],
}
