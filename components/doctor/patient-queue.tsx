"use client"

import { useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { formatPatientDigits } from "@/lib/patients"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Stethoscope } from "lucide-react"

interface PatientQueueProps {
  onSelectPatient: (patientId: string) => void
}

export function PatientQueue({ onSelectPatient }: PatientQueueProps) {
  const { patients, searchPatients } = usePatients()
  const [searchQuery, setSearchQuery] = useState("")

  const displayedPatients = searchQuery ? searchPatients(searchQuery) : patients

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Queue</CardTitle>
        <CardDescription>Select a patient to begin consultation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {displayedPatients.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-muted-foreground">
            No patients match your search
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 px-3">P.ID</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Age</th>
                  <th className="py-3 px-3">Sex</th>
                  <th className="py-3 px-3">Blood</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedPatients.map((patient) => {
                  const pid = formatPatientDigits(patient.patientNumber)
                  const derivedAge =
                    patient.dateOfBirth && !Number.isNaN(new Date(patient.dateOfBirth).getTime())
                      ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear())
                      : null
                  const age = patient.ageYears ?? derivedAge ?? "-"
                  return (
                    <tr
                      key={patient.id}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="py-3 px-3 font-mono text-foreground">{pid ? `P.${pid}` : "—"}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">
                          {patient.firstName} {patient.lastName}
                        </div>
                        {patient.allergies && patient.allergies.trim().toLowerCase() !== "none" && (
                          <Badge variant="destructive" className="mt-1">
                            Allergies
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">{age}</td>
                      <td className="py-3 px-3 capitalize">{patient.gender || "—"}</td>
                      <td className="py-3 px-3">{patient.bloodGroup || "—"}</td>
                      <td className="py-3 px-3">{patient.phone || "—"}</td>
                      <td className="py-3 px-3 text-right">
                        <Button size="sm" onClick={() => onSelectPatient(patient.id)}>
                          <Stethoscope className="mr-2 h-4 w-4" />
                          Consult
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
