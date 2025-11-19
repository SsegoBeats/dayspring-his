 

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import crypto from "crypto"

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Password strength validation
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// JWT token generation
export function generateToken(userId: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set")
  }
  return jwt.sign({ sub: userId, email, role, iss: "dayspring-his", aud: "dayspring-his" }, secret, {
    algorithm: "HS256",
    expiresIn: "8h",
  })
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error("JWT_SECRET is not set")
    }
    const decoded = jwt.verify(token, secret, { audience: "dayspring-his", issuer: "dayspring-his" }) as any
    return { userId: decoded.sub, email: decoded.email, role: decoded.role }
  } catch (error) {
    console.error("[v0] Token verification failed:", error)
    return null
  }
}

// RBAC
type Role =
  | "Receptionist"
  | "Doctor"
  | "Clinician"
  | "Radiologist"
  | "Nurse"
  | "Lab Tech"
  | "Hospital Admin"
  | "Cashier"
  | "Pharmacist"
  | "Midwife"
  | "Dentist"
type Action = "read" | "create" | "update" | "delete"
type Resource =
  | "patients"
  | "appointments"
  | "billing"
  | "medical"
  | "pharmacy"
  | "lab"
  | "radiology"
  | "users"
  | "email"
  | "exports"
  | "beds"
  | "checkins"
  | "queues"
  | "payments"
  | "documents"
  | "insurance"

const rolePolicies: Record<Role, Partial<Record<Resource, Action[]>>> = {
  Receptionist: {
    patients: ["read", "create", "update", "delete"],
    appointments: ["read", "create", "update"],
    beds: ["read"], // Can view bed availability for patient admission
    checkins: ["read", "create", "update"],
    queues: ["read", "create", "update", "delete"],
    // Receptionist should NOT create payments; Cashier handles collection.
    payments: ["read"],
    documents: ["read", "create", "delete"],
    insurance: ["read", "create", "update", "delete"],
    exports: ["read", "create"], // Allow receptionist to export register/dashboard/daily
  },
  Doctor: {
    patients: ["read"],
    medical: ["read", "create", "update"],
    appointments: ["read", "update"],
    lab: ["read", "create"],
    radiology: ["read", "create"],
    pharmacy: ["read"],
    billing: ["create"],
    beds: ["read"], // Can view bed status for patient care decisions
  },
  Midwife: {
    patients: ["read"],
    medical: ["read", "create", "update"],
    appointments: ["read", "update"],
    lab: ["read", "create"],
    radiology: ["read", "create"],
    pharmacy: ["read"],
    billing: ["create"],
    beds: ["read"], // Can view bed status for patient care decisions
  },
  Dentist: {
    patients: ["read"],
    medical: ["read", "create", "update"],
    appointments: ["read", "update"],
    lab: ["read", "create"],
    radiology: ["read", "create"],
    pharmacy: ["read"],
    billing: ["create"],
    beds: ["read"], // Can view bed status for patient care decisions
  },
  Clinician: {
    patients: ["read"],
    medical: ["read", "create", "update"],
    appointments: ["read", "update"],
    lab: ["read", "create"],
    radiology: ["read", "create"],
    pharmacy: ["read"],
    billing: ["create"],
    beds: ["read"], // Can view bed status for patient care decisions
  },
  Radiologist: {
    radiology: ["read", "create", "update"],
    patients: ["read"],
    beds: ["read"], // Can view bed status for patient care decisions
  },
  Nurse: {
    patients: ["read", "update"],
    medical: ["read", "create"],
    appointments: ["read", "update"],
    beds: ["read", "update"], // Can edit bed status and assign patients
  },
  "Lab Tech": {
    lab: ["read", "create", "update"],
    patients: ["read"],
    beds: ["read"], // Can view bed status for patient care decisions
  },
  "Hospital Admin": {
    users: ["read", "create", "update", "delete"],
    patients: ["read", "delete"],
    appointments: ["read", "create", "update", "delete"],
    billing: ["read", "create", "update", "delete"],
    medical: ["read", "create", "update", "delete"],
    pharmacy: ["read", "create", "update", "delete"],
    lab: ["read", "create", "update", "delete"],
    radiology: ["read", "create", "update", "delete"],
    email: ["create"],
    exports: ["read", "create", "delete"],
    beds: ["read", "create", "update", "delete"], // Full bed management control
    checkins: ["read", "create", "update", "delete"],
    queues: ["read", "create", "update", "delete"],
    payments: ["read", "create", "update", "delete"],
    documents: ["read", "create", "update", "delete"],
    insurance: ["read", "create", "update", "delete"],
  },
  Cashier: {
    billing: ["read", "create", "update"],
    patients: ["read"],
    exports: ["read", "create"], // Allow cashiers to export billing data
    beds: ["read"], // Can view bed status for billing purposes
    payments: ["read", "create", "update"],
  },
  Pharmacist: {
    pharmacy: ["read", "update"],
    patients: ["read"],
    beds: ["read"], // Can view bed status for medication delivery
  },
  Midwife: {
    patients: ["read"],
    medical: ["read", "create", "update"],
    appointments: ["read", "update"],
    lab: ["read", "create"],
    radiology: ["read", "create"],
    pharmacy: ["read"],
    billing: ["create"],
    beds: ["read"], // Can view bed status for patient care decisions
    exports: ["create"],
  },
  Dentist: {
    patients: ["read"],
    medical: ["read", "create", "update"],
    appointments: ["read", "update"],
    lab: ["read", "create"],
    radiology: ["read", "create"],
    pharmacy: ["read"],
    billing: ["create"],
    beds: ["read"], // Can view bed status for patient care decisions
    exports: ["create"],
  },
}

export function can(role: string, resource: Resource, action: Action): boolean {
  const r = (role || "") as Role
  const policies = rolePolicies[r]
  if (!policies) return false
  const allowed = policies[resource]
  return !!allowed && allowed.includes(action)
}

// Generate secure random token for password reset
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

// Generate barcode data
export function generateBarcodeData(type: string, id: string, data: any): string {
  // Create a JSON string with the data
  const barcodeData = {
    type, // 'prescription', 'payment', 'lab', etc.
    id,
    data,
    timestamp: new Date().toISOString(),
  }

  // Encode as base64 for barcode
  return Buffer.from(JSON.stringify(barcodeData)).toString("base64")
}

export function decodeBarcodeData(barcode: string): any {
  try {
    const decoded = Buffer.from(barcode, "base64").toString("utf-8")
    return JSON.parse(decoded)
  } catch (error) {
    console.error("[v0] Barcode decoding failed:", error)
    return null
  }
}

// Input sanitization
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim()
}

// Generate receipt number
export function generateReceiptNumber(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")

  return `DMC${year}${month}${day}${random}`
}

// Generate patient number
export async function generatePatientNumber(): Promise<string> {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")

  return `P${year}${random}`
}
