import { jwtVerify } from "jose"

export type TokenPayloadEdge = {
  sub: string
  userId: string
  email: string
  role: string
}

export async function verifyTokenEdge(token: string): Promise<TokenPayloadEdge | null> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET is not set")
    }

    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "dayspring-his",
      audience: "dayspring-his",
      algorithms: ["HS256"],
    })

    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.role !== "string") {
      return null
    }

    return {
      sub: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    }
  } catch (error) {
    console.error("[v0] Edge token verification failed:", error)
    return null
  }
}
