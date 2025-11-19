"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"

export default function RunMigrationsPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const runMigrations = async () => {
    setRunning(true)
    setResult(null)

    try {
      const response = await fetch("/api/migrate")
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to run migrations",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Database Migrations</h1>
          <p className="text-muted-foreground mt-2">Set up or upgrade your database schema</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will create or update all necessary tables. Safe to run multiple times.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Run Database Migrations</CardTitle>
            <CardDescription>This will execute the following:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Create all database tables (users, patients, appointments, etc.)</li>
              <li>Set up indexes for performance</li>
              <li>Create database triggers and functions</li>
            </ul>

            <Button onClick={runMigrations} disabled={running} className="w-full" size="lg">
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Migrations...
                </>
              ) : (
                "Run Migrations Now"
              )}
            </Button>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <AlertDescription className="font-semibold">
                      {result.success ? "Migrations Completed Successfully!" : "Migration Failed"}
                    </AlertDescription>

                    {result.success ? (
                      <div className="space-y-3 text-sm">
                        <p>{result.message}</p>
                        <Button onClick={() => (window.location.href = "/")} className="w-full mt-4">
                          Go to Login Page
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>Error:</strong> {result.error}
                        </p>
                        {result.details && (
                          <p className="text-xs opacity-80 font-mono bg-muted p-2 rounded">{result.details}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>If migrations fail, check:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>PostgreSQL service is running</li>
              <li>Database "dayspring_medical_center" exists</li>
              <li>User "postgres" has proper permissions</li>
              <li>DATABASE_URL environment variable is correct</li>
            </ul>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/test-connection")}
              className="w-full mt-4"
            >
              Test Database Connection First
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
