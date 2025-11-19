import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST() {
  try {
    // Add new columns to users table
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS department VARCHAR(100),
      ADD COLUMN IF NOT EXISTS role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS signature VARCHAR(255)
    `)
    // Backfill role and enforce NOT NULL if possible
    await query(`UPDATE users SET role = 'Hospital Admin' WHERE role IS NULL`)
    try { await query(`ALTER TABLE users ALTER COLUMN role SET NOT NULL`) } catch {}

    // Add notification columns to user_settings
    await query(`
      ALTER TABLE user_settings 
      ADD COLUMN IF NOT EXISTS appointment_alerts BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS lab_results BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS system_updates BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS emergency_alerts BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Kampala',
      ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
      ADD COLUMN IF NOT EXISTS default_dashboard VARCHAR(50) DEFAULT 'overview'
    `)

    return NextResponse.json({ 
      success: true, 
      message: "Settings columns added successfully" 
    })
  } catch (error: any) {
    console.error("Migration error:", error)
    return NextResponse.json({ 
      error: "Migration failed",
      details: error.message 
    }, { status: 500 })
  }
}
