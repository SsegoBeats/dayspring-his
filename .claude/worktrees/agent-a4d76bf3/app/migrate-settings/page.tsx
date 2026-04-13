"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function MigrateSettingsPage() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")

  const runMigration = async () => {
    setRunning(true)
    setMessage("")
    try {
      const res = await fetch("/api/migrate-settings", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message)
      } else {
        setMessage(data.error || "Migration failed")
      }
    } catch (error) {
      setMessage("Migration failed: " + error)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Settings Migration</CardTitle>
          <CardDescription>
            Add notification columns to user_settings table
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runMigration} 
            disabled={running}
            className="w-full"
          >
            {running ? "Running..." : "Run Migration"}
          </Button>
          {message && (
            <p className="text-sm">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
