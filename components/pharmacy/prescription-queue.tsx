"use client"

import { useState } from "react"
import type { Prescription } from "@/lib/medical-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Package, Search } from "lucide-react"

interface PrescriptionQueueProps {
  prescriptions: Prescription[]
  onSelectPrescription: (prescriptionId: string) => void
  title: string
  emptyMessage: string
}

export function PrescriptionQueue({
  prescriptions,
  onSelectPrescription,
  title,
  emptyMessage,
}: PrescriptionQueueProps) {
  const [query, setQuery] = useState("")

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = prescriptions.filter((p) => {
    if (!normalizedQuery) return true
    const inPatient = p.patientName.toLowerCase().includes(normalizedQuery)
    const inDoctor = p.doctorName.toLowerCase().includes(normalizedQuery)
    const inMed = p.medications.some((m) => m.name.toLowerCase().includes(normalizedQuery))
    return inPatient || inDoctor || inMed
  })

  const showEmptyBase = prescriptions.length === 0
  const showEmptyFilter = !showEmptyBase && filtered.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>View and dispense prescriptions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by patient, clinician, or medication"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {showEmptyBase ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
            <Package className="h-8 w-8 text-muted-foreground/70" />
            <p className="text-sm font-medium">No active prescriptions at the moment.</p>
            <p className="text-xs">{emptyMessage}</p>
          </div>
        ) : showEmptyFilter ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No prescriptions match your filters.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((prescription) => (
              <div
                key={prescription.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{prescription.patientName}</p>
                    <Badge
                      variant={
                        prescription.status === "active"
                          ? "secondary"
                          : prescription.status === "completed"
                            ? "default"
                            : "destructive"
                      }
                    >
                      {prescription.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                    <span>ID: {prescription.id}</span>
                    <span>Date: {prescription.date}</span>
                    <span>Clinician: {prescription.doctorName}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{prescription.medications.length} medication(s)</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onSelectPrescription(prescription.id)}>
                  <Package className="mr-2 h-4 w-4" />
                  {prescription.status === "active" ? "Dispense" : "View"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

