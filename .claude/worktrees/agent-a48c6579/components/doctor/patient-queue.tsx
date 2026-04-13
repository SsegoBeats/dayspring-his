"use client"
import { useMemo, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { formatPatientNumber } from "@/lib/patients"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Search, Stethoscope, Users } from "lucide-react"

interface PatientQueueProps {
  onSelectPatient: (patientId: string) => void
  filterPatientIds?: string[] | null
  filterEmptyMessage?: string
}

export function PatientQueue({ onSelectPatient, filterPatientIds, filterEmptyMessage }: PatientQueueProps) {
  const { patients, searchPatients } = usePatients()
  const [search, setSearch] = useState("")

  const baseList = useMemo(
    () => (search ? searchPatients(search) : patients),
    [search, searchPatients, patients]
  )
  const displayedPatients =
    filterPatientIds != null
      ? baseList.filter((p) => filterPatientIds.includes(p.id))
      : baseList

  const currentYear = new Date().getFullYear()

  return (
    <Card className="rounded-2xl border-l-4 border-teal-600 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search patients by name, ID, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 focus-visible:ring-teal-400"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayedPatients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-teal-300" />
            <p className="text-sm text-slate-500">
              {filterPatientIds != null
                ? (filterEmptyMessage ?? "No patients in today's queue.")
                : search
                ? "No patients match your search."
                : "No patients in queue."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {["P.ID", "Name", "Age", "Sex", "Blood", "Phone", "Action"].map((h) => (
                  <TableHead
                    key={h}
                    className={`text-xs font-semibold uppercase tracking-widest text-teal-400 ${h === "Action" ? "text-right" : ""}`}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPatients.map((patient) => {
                const pid = formatPatientNumber(patient.patientNumber)
                const derivedAge =
                  patient.dateOfBirth && !Number.isNaN(new Date(patient.dateOfBirth).getTime())
                    ? Math.max(0, currentYear - new Date(patient.dateOfBirth).getFullYear())
                    : null
                const age = patient.ageYears ?? derivedAge ?? "—"
                const allergyStr = patient.allergies?.trim()
                const hasAllergy = !!allergyStr && allergyStr.toLowerCase() !== "none"

                return (
                  <TableRow key={patient.id} className="hover:bg-teal-50/40">
                    <TableCell className="font-mono text-sm text-teal-600">{pid}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </div>
                      {hasAllergy && (
                        <span className="mt-0.5 inline-block rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                          Allergies
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{age}</TableCell>
                    <TableCell className="capitalize text-slate-600">{patient.gender || "—"}</TableCell>
                    <TableCell className="text-slate-600">{patient.bloodGroup || "—"}</TableCell>
                    <TableCell className="text-slate-600">{patient.phone || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-teal-700 text-white hover:bg-teal-800"
                        onClick={() => onSelectPatient(patient.id)}
                      >
                        <Stethoscope className="mr-1.5 h-4 w-4" />
                        Consult
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
