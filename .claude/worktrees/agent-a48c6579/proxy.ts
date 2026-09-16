import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname
  
  // Skip static files - let Next.js handle them directly
  const staticExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js', '.json', '.xml', '.pdf', '.txt', '.webmanifest']
  if (staticExtensions.some(ext => pathname.endsWith(ext)) || pathname === '/sw.js') {
    return NextResponse.next()
  }
  
  const token = req.cookies.get("session")?.value || req.cookies.get("session_dev")?.value
  const protectedPrefixes = ["/appointments", "/billing", "/medical-history"]
  const requestId = req.headers.get("x-request-id") || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)

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
    /*
     * Match all request paths except:
     * - _next (Next.js internals)
     * - api/public (public API routes)
     */
    "/((?!_next|api/public).*)"
  ]
}
