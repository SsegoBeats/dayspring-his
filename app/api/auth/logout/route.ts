import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (token) {
      const payload = verifyToken(token)
      if (payload) {
        // Log the logout action
        await writeAuditLog({
          userId: payload.userId,
          action: "LOGOUT",
          entityType: "User",
          entityId: payload.userId,
          details: { 
            category: "AUTHENTICATION", 
            description: `User logged out` 
          },
          ip: "127.0.0.1" // In production, get real IP
        })
      }
    }
    
    const store = await cookies()
    store.delete("session")
    if (process.env.NODE_ENV !== "production") {
      store.delete("session_dev")
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ success: true }) // Still logout even if audit fails
  }
}



