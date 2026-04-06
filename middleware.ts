import { type NextRequest, NextResponse } from "next/server"

// ─── CSRF protection (double-submit cookie pattern) ───────────────────────────
//
// Flow:
//   1. Browser fetches GET /api/csrf → server sets csrfToken cookie (non-HttpOnly)
//      and returns the token in the JSON body.
//   2. Frontend reads the token and includes it as x-csrf-token on every
//      state-changing request (POST / PUT / PATCH / DELETE).
//   3. This middleware compares the header value with the cookie value.
//      An attacker-controlled cross-origin page cannot read the HttpOnly session
//      cookie, AND cannot read the csrfToken cookie value (same-origin policy
//      prevents JS on another origin from reading document.cookie for this domain).
//      The matching check defeats cross-origin form submissions.
//
// Routes that are explicitly exempted:
//   - Safe HTTP methods (GET, HEAD, OPTIONS)
//   - Pre-authentication routes (login, password-reset) — user has no session yet
//   - External webhook/IPN callbacks (PesaPal) — no browser involved
//   - Server-to-server job runner (uses its own JOBS_RUNNER_TOKEN)
//   - Cron cleanup (server-initiated)
//   - The CSRF token endpoint itself
// ─────────────────────────────────────────────────────────────────────────────

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Paths that must not require a CSRF token (pre-auth or server-to-server).
const CSRF_EXEMPT_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/csrf",
  "/api/pesapal/ipn",    // PesaPal payment callback
  "/api/jobs/run",       // authenticated via JOBS_RUNNER_TOKEN
  "/api/cron/",          // server-initiated cron jobs
  "/api/heartbeat",
  "/api/openapi",
]

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only enforce on /api routes.
  if (!pathname.startsWith("/api/")) return NextResponse.next()

  // Safe methods never carry state changes — skip.
  if (SAFE_METHODS.has(req.method)) return NextResponse.next()

  // Explicitly exempted routes.
  if (isCsrfExempt(pathname)) return NextResponse.next()

  // ── Double-submit cookie check ────────────────────────────────────────────
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
  const valid =
    hBuf.length === cBuf.length &&
    hBuf.every((b, i) => b === cBuf[i])

  if (!valid) {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
