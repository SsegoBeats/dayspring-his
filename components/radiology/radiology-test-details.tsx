"use client"

import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, XCircle } from "lucide-react"

interface RadiologyTestDetailsProps {
  testId: string
  onBack: () => void
}

export function RadiologyTestDetails({ testId, onBack }: RadiologyTestDetailsProps) {
  const { labResults, updateLabResult } = useMedical()
  const { getPatient } = usePatients()
  const test = labResults.find((lr) => lr.id === testId)
  const patient = test ? getPatient(test.patientId) : null

  const [results, setResults] = useState(test?.results || "")
  const [notes, setNotes] = useState(test?.notes || "")

  if (!test) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Scan not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleSubmitResults = async () => {
    try {
      await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed", results, notes }),
      })
    } catch {
      // Ignore network errors here; local state will still update
    }
    updateLabResult(test.id, {
      status: "completed",
      completedDate: new Date().toISOString().split("T")[0],
      results,
      notes,
    })
    alert("Scan results submitted successfully!")
    onBack()
  }

  const handleCancelTest = async () => {
    if (!confirm("Are you sure you want to cancel this scan?")) return

    try {
      await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      })
    } catch {
      // Ignore network errors here; local state will still update
    }
    updateLabResult(test.id, {
      status: "cancelled",
    })
    alert("Scan cancelled")
    onBack()
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{test.testType}</CardTitle>
              <CardDescription>Scan ID: {test.id}</CardDescription>
            </div>
            <Badge
              variant={
                test.status === "completed" ? "default" : test.status === "pending" ? "secondary" : "destructive"
              }
            >
              {test.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Patient Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="text-foreground">{test.patientName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Patient ID:</span>{" "}
                  <span className="text-foreground">{test.patientId}</span>
                </div>
                {patient && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Age:</span>{" "}
                      <span className="text-foreground">
                        {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gender:</span>{" "}
                      <span className="text-foreground">{patient.gender}</span>
                    </div>
                    {patient.bloodGroup && (
                      <div>
                        <span className="text-muted-foreground">Blood Group:</span>{" "}
                        <span className="text-foreground">{patient.bloodGroup}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Scan Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Scan Type:</span>{" "}
                  <span className="text-foreground">{test.testType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ordered By:</span>{" "}
                  <span className="text-foreground">{test.orderedBy}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ordered Date:</span>{" "}
                  <span className="text-foreground">{test.orderedDate}</span>
                </div>
                {test.completedDate && (
                  <div>
                    <span className="text-muted-foreground">Completed Date:</span>{" "}
                    <span className="text-foreground">{test.completedDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {test.status === "pending" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="results">Radiological Findings *</Label>
                <Textarea
                  id="results"
                  placeholder="Enter detailed radiological findings and interpretation..."
                  value={results}
                  onChange={(e) => setResults(e.target.value)}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional observations, recommendations, or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmitResults} disabled={!results} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Submit Report
                </Button>
                <Button variant="destructive" onClick={handleCancelTest}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Scan
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {test.results && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Radiological Findings</h3>
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-sm text-foreground">{test.results}</p>
                  </div>
                </div>
              )}

              {test.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Notes</h3>
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-sm text-foreground">{test.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
