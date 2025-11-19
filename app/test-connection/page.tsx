"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

export default function TestConnectionPage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testConnection = async () => {
    setTesting(true)
    setResult(null)

    try {
      const response = await fetch("/api/test-db")
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to connect to API endpoint",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Database Connection Test</h1>
          <p className="text-muted-foreground mt-2">Test your PostgreSQL database connection</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>Testing connection to: localhost:5432/dayspring_medical_center</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testConnection} disabled={testing} className="w-full">
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                "Test Database Connection"
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
                      {result.success ? "Connection Successful!" : "Connection Failed"}
                    </AlertDescription>

                    {result.success ? (
                      <div className="space-y-1 text-sm">
                        <p>
                          <strong>Database:</strong> {result.database}
                        </p>
                        <p>
                          <strong>Version:</strong> {result.version}
                        </p>
                        <p>
                          <strong>Current Time:</strong> {result.currentTime}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>Error:</strong> {result.error}
                        </p>
                        {result.details && <p className="text-xs opacity-80">{result.details}</p>}

                        <div className="mt-4 space-y-2 border-t pt-3">
                          <p className="font-semibold">Troubleshooting Steps:</p>
                          <ul className="list-disc list-inside space-y-1 opacity-90">
                            <li>Ensure PostgreSQL is running on localhost:5432</li>
                            <li>Verify database "dayspring_medical_center" exists</li>
                            <li>Check username (postgres) and password (Admin2025)</li>
                            <li>Confirm DATABASE_URL environment variable is set in your .env file</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            {result?.success && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Your database is connected! Ready to run migrations?
                </p>
                <Button onClick={() => (window.location.href = "/run-migrations")} variant="outline" className="w-full">
                  Proceed to Run Migrations
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local PostgreSQL Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                This system is configured for local PostgreSQL. Download the code and run it in your IDE where it can
                access localhost:5432.
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                DATABASE_URL=postgresql://postgres:Admin2025@localhost:5432/dayspring_medical_center
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
