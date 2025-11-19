"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Trash2, AlertCircle, Loader2, Eye, FileSpreadsheet, FileText, RefreshCw, UserCircle2, Filter, X, ChevronDown, ChevronUp } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { useFormatCurrency } from "@/lib/settings-context"
import { useFormatDate } from "@/lib/date-utils"
import { formatPatientNumber } from "@/lib/patients"

// Helper function to calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

interface Patient {
  id: string
  patient_number: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  email: string | null
  address: string | null
  blood_group: string | null
  bloodGroup?: string | null
  age_years: number | null
  current_status: string | null
  nin: string | null
  district: string | null
  subcounty: string | null
  parish: string | null
  village: string | null
  occupation: string | null
  next_of_kin_name: string | null // Legacy field - can be removed later
  next_of_kin_first_name: string | null
  next_of_kin_last_name: string | null
  next_of_kin_country: string | null
  next_of_kin_phone: string | null
  next_of_kin_relation: string | null
  next_of_kin_residence: string | null
  insurance_provider: string | null
  insurance_member_no: string | null
  created_at: string
  latest_triage_category: string | null
  latest_triage_complaint: string | null
  latest_temperature: number | null
  latest_heart_rate: number | null
  latest_systolic: number | null
  latest_diastolic: number | null
  latest_respiratory_rate: number | null
  latest_spo2: number | null
  latest_avpu: string | null
  latest_triage_mode: string | null
  latest_triage_mobility: string | null
  latest_pain_level: number | null
  latest_is_pregnant: boolean | null
  latest_pregnancy_weeks: number | null
  latest_is_postpartum: boolean | null
  latest_postpartum_days: number | null
  latest_has_trauma: boolean | null
  latest_trauma_type: string | null
  latest_trauma_mechanism: string | null
  latest_burns_percentage: number | null
  latest_weight: number | null
  latest_has_respiratory_distress: boolean | null
  latest_has_chest_pain: boolean | null
  latest_has_severe_bleeding: boolean | null
  latest_triage_date: string | null
}

export function AdminPatientManagement() {
  const formatCurrency = useFormatCurrency()
  const { formatDateTime } = useFormatDate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    gender: "",
    status: "",
    triage: "",
    minAge: "",
    maxAge: "",
    registeredAfter: "",
    registeredBefore: "",
  })
  
  const fetchPatients = async (append: boolean = false) => {
    try {
      append ? setLoadingMore(true) : setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (append && cursor) params.set('after', cursor)
      const response = await fetch(`/api/patients?${params.toString()}`, {
        credentials: "include",
      })
      
      if (!response.ok) {
        throw new Error("Failed to fetch patients")
      }

      const data = await response.json()
      if (append) {
        setPatients((prev) => [...prev, ...(data.patients || [])])
      } else {
        setPatients(data.patients || [])
      }
      setCursor(data.nextCursor || null)
      setHasMore(Boolean(data.nextCursor))
    } catch (err) {
      console.error("Error fetching patients:", err)
      setError("Failed to load patient data")
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])

  const loadMore = async () => {
    if (!hasMore || loadingMore) return
    await fetchPatients(true)
  }

  const handleViewDetails = async (patient: Patient) => {
    try {
      // Load the freshest row from DB including any columns not in list view
      const res = await fetch(`/api/patients?id=${encodeURIComponent(patient.id)}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json().catch(()=>({}))
        const p = Array.isArray(data?.patients) && data.patients[0] ? data.patients[0] : patient
        setViewingPatient(p)
      } else {
        setViewingPatient(patient)
      }
    } catch {
      setViewingPatient(patient)
    }
    setViewDialogOpen(true)
  }

  const handleDelete = (patient: Patient) => {
    setSelectedPatient(patient)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedPatient) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/patients?id=${selectedPatient.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to delete patient")
      }

      toast({
        title: "Patient Deleted",
        description: `Patient ${selectedPatient.first_name} ${selectedPatient.last_name} has been deleted successfully`,
      })

      await fetchPatients()
      setDeleteDialogOpen(false)
      setSelectedPatient(null)
    } catch (err) {
      console.error("Error deleting patient:", err)
      toast({
        title: "Deletion Failed",
        description: err instanceof Error ? err.message : "Failed to delete patient",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      setExporting(true)
      
      const response = await fetch("/api/exports/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          dataset: "patients",
          format: format,
          filters: {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        const errorMessage = errorData.error || "Failed to export patient data"
        if (errorData.details) {
          console.error("Export validation details:", errorData.details)
        }
        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      const extension = format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"
      const contentType = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : 
                         format === "pdf" ? "application/pdf" : "text/csv"
      
      a.download = `patients-export-${new Date().toISOString().split("T")[0]}.${extension}`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: `Patient data exported as ${format.toUpperCase()} successfully`,
      })
    } catch (err) {
      console.error("Error exporting patients:", err)
      toast({
        title: "Export Failed",
        description: "Failed to export patient data",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const filteredPatients = patients.filter((patient) => {
    const search = searchQuery.toLowerCase()
    const matchesSearch =
      !search ||
      patient.first_name?.toLowerCase().includes(search) ||
      patient.last_name?.toLowerCase().includes(search) ||
      patient.patient_number?.toLowerCase().includes(search) ||
      patient.phone?.toLowerCase().includes(search) ||
      patient.next_of_kin_first_name?.toLowerCase().includes(search) ||
      patient.next_of_kin_last_name?.toLowerCase().includes(search) ||
      patient.next_of_kin_name?.toLowerCase().includes(search) ||
      patient.next_of_kin_phone?.toLowerCase().includes(search)

    const ageValue = patient.age_years ?? (patient.date_of_birth ? calculateAge(patient.date_of_birth) : null)
    const matchesGender = !filters.gender || patient.gender?.toLowerCase() === filters.gender.toLowerCase()
    const matchesStatus = !filters.status || (patient.current_status || "").toLowerCase() === filters.status.toLowerCase()
    const matchesTriage = !filters.triage || (patient.latest_triage_category || "").toLowerCase() === filters.triage.toLowerCase()
    const matchesMinAge = !filters.minAge || (ageValue != null && ageValue >= Number(filters.minAge))
    const matchesMaxAge = !filters.maxAge || (ageValue != null && ageValue <= Number(filters.maxAge))
    const created = patient.created_at ? patient.created_at.slice(0,10) : ""
    const matchesAfter = !filters.registeredAfter || created >= filters.registeredAfter
    const matchesBefore = !filters.registeredBefore || created <= filters.registeredBefore

    return matchesSearch && matchesGender && matchesStatus && matchesTriage && matchesMinAge && matchesMaxAge && matchesAfter && matchesBefore
  })

  const viewingPatientAge = viewingPatient
    ? viewingPatient.age_years ?? (viewingPatient.date_of_birth ? calculateAge(viewingPatient.date_of_birth) : null)
    : null

  const viewingPatientBloodGroup = viewingPatient
    ? viewingPatient.blood_group ?? viewingPatient.bloodGroup ?? null
    : null

  const totalPatients = patients.length
  const newlyRegisteredToday = patients.filter(p => p.created_at?.slice(0,10) === new Date().toISOString().slice(0,10)).length
  const notTriaged = patients.filter(p => !p.latest_triage_category).length
  const maleCount = patients.filter(p => (p.gender || "").toLowerCase() === "male").length
  const femaleCount = patients.filter(p => (p.gender || "").toLowerCase() === "female").length
  const avgAge = (() => {
    const ages = patients
      .map(p => p.age_years ?? (p.date_of_birth ? calculateAge(p.date_of_birth) : null))
      .filter((v): v is number => typeof v === "number" && v > 0)
    if (!ages.length) return null
    return Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
  })()

  const activeFilters = Object.entries(filters).filter(([, v]) => v)

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading patients...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPatients()}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Patient Management</CardTitle>
              <CardDescription>View, filter, and export patient records across the hospital.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPatients()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
                {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={exporting || patients.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? "Exporting..." : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("csv")} disabled={exporting}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")} disabled={exporting}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={exporting}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Analytics strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-sky-100 bg-sky-50/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Total patients</p>
              <p className="text-lg font-semibold text-slate-900">{totalPatients}</p>
            </div>
            <div className="rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Registered today</p>
              <p className="text-lg font-semibold text-emerald-800">{newlyRegisteredToday}</p>
            </div>
            <div className="rounded-md border border-amber-100 bg-amber-50/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Not triaged</p>
              <p className="text-lg font-semibold text-amber-800">{notTriaged}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Gender mix</p>
                <p className="text-xs text-muted-foreground">M:{maleCount} · F:{femaleCount}</p>
              </div>
              {avgAge && (
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Avg age</p>
                  <p className="text-sm font-semibold text-slate-900">{avgAge} yrs</p>
                </div>
              )}
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="patient-search"
                name="patient-search"
                placeholder="Search by name, ID, phone, or next of kin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] md:ml-auto">
                {activeFilters.map(([key, value]) => (
                  <button
                    key={`${key}-${value}`}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2 py-0.5 text-slate-700"
                    onClick={() => setFilters({ ...filters, [key]: "" })}
                  >
                    <span className="font-medium">{key.replace(/([A-Z])/g,' $1')}:</span>
                    <span>{String(value)}</span>
                    <X className="h-3 w-3 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-muted/50 rounded-md">
              <div>
                <Label htmlFor="gender-filter">Gender</Label>
                <Input
                  id="gender-filter"
                  placeholder="male / female"
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Input
                  id="status-filter"
                  placeholder="registered, discharged..."
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="triage-filter">Triage</Label>
                <Input
                  id="triage-filter"
                  placeholder="Emergency, Urgent..."
                  value={filters.triage}
                  onChange={(e) => setFilters({ ...filters, triage: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="min-age">Min age</Label>
                <Input
                  id="min-age"
                  type="number"
                  value={filters.minAge}
                  onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="max-age">Max age</Label>
                <Input
                  id="max-age"
                  type="number"
                  value={filters.maxAge}
                  onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Registration date</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filters.registeredAfter}
                    onChange={(e) => setFilters({ ...filters, registeredAfter: e.target.value })}
                    className="text-xs"
                  />
                  <Input
                    type="date"
                    value={filters.registeredBefore}
                    onChange={(e) => setFilters({ ...filters, registeredBefore: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Patient</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Triage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {searchQuery ? "No patients found matching your search" : "No patients found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((patient, idx) => (
                    <TableRow key={patient.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-700">
                            {`${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}`.toUpperCase() || 'P'}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                              <span>{patient.first_name} {patient.last_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="font-mono">{formatPatientNumber(patient.patient_number)}</span>
                              <span>·</span>
                              <span>{patient.phone || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const ageValue = patient.age_years ?? (patient.date_of_birth ? calculateAge(patient.date_of_birth) : null)
                          return ageValue !== null && ageValue !== undefined ? <span className="text-sm text-slate-700">{ageValue} years</span> : "-"
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1 text-sm">
                          <span className="h-2 w-2 rounded-full bg-sky-500" />
                          <span className="capitalize">{patient.gender || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{patient.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          className="text-[11px]"
                          variant="secondary"
                        >
                          {patient.current_status || "Registered"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {patient.latest_triage_category ? (
                          <Badge
                            className="text-[11px]"
                            variant={
                              patient.latest_triage_category === "Emergency" ? "destructive" :
                              patient.latest_triage_category === "Very Urgent" ? "destructive" :
                              patient.latest_triage_category === "Urgent" ? "default" :
                              "secondary"
                            }
                          >
                            {patient.latest_triage_category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not triaged</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(patient)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-destructive/40 text-destructive hover:bg-destructive/5"
                            onClick={() => handleDelete(patient)}
                            title="Delete patient"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing <strong>{filteredPatients.length}</strong> of <strong>{patients.length}</strong> patient{patients.length !== 1 ? 's' : ''}
              {searchQuery && (
                <span> matching &quot;{searchQuery}&quot;</span>
              )}
            </span>
            {patients.length > 0 && (
              <Badge variant="outline" className="ml-2">
                Total: {patients.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              Complete demographic and medical information for patient {formatPatientNumber(viewingPatient?.patient_number)}
            </DialogDescription>
          </DialogHeader>
          
          {viewingPatient && (
            <div className="space-y-6">
              {/* Demographic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Demographic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Patient Number</label>
                    <p className="text-sm">{formatPatientNumber(viewingPatient.patient_number)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="text-sm">{viewingPatient.first_name} {viewingPatient.last_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Age</label>
                    <p className="text-sm">
                      {viewingPatientAge !== null && viewingPatientAge !== undefined ? `${viewingPatientAge} years` : "-"}
                      {viewingPatient.date_of_birth && (
                        <span className="text-xs text-muted-foreground block">DOB: {String(viewingPatient.date_of_birth).slice(0,10)}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <p className="text-sm">{viewingPatient.gender}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm">{viewingPatient.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="text-sm">{viewingPatient.address || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NIN</label>
                    <p className="text-sm">{viewingPatient.nin || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
                    <p className="text-sm">{viewingPatientBloodGroup || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">District</label>
                    <p className="text-sm">{viewingPatient.district || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Subcounty</label>
                    <p className="text-sm">{viewingPatient.subcounty || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Parish</label>
                    <p className="text-sm">{viewingPatient.parish || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Village</label>
                    <p className="text-sm">{viewingPatient.village || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Occupation</label>
                    <p className="text-sm">{viewingPatient.occupation || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Insurance Provider</label>
                    <p className="text-sm">{viewingPatient.insurance_provider || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Insurance Member No</label>
                    <p className="text-sm">{viewingPatient.insurance_member_no || "-"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Next of Kin Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Next of Kin Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <p className="text-sm">{viewingPatient.next_of_kin_first_name || viewingPatient.next_of_kin_name?.split(' ')[0] || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <p className="text-sm">{viewingPatient.next_of_kin_last_name || viewingPatient.next_of_kin_name?.split(' ').slice(1).join(' ') || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Country</label>
                    <p className="text-sm">{viewingPatient.next_of_kin_country || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm">{viewingPatient.next_of_kin_phone || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Residence</label>
                    <p className="text-sm">{viewingPatient.next_of_kin_residence || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                    <p className="text-sm">{viewingPatient.next_of_kin_relation || "-"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* OPD/Triage Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4">OPD/Triage Details</h3>
                {viewingPatient.latest_triage_date ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Triage Category</label>
                      <p className="text-sm">
                        <Badge variant={
                          viewingPatient.latest_triage_category === "Emergency" ? "destructive" :
                          viewingPatient.latest_triage_category === "Very Urgent" ? "destructive" :
                          viewingPatient.latest_triage_category === "Urgent" ? "default" :
                          "secondary"
                        }>
                          {viewingPatient.latest_triage_category || "-"}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Triage Date</label>
                      <p className="text-sm">{formatDateTime(viewingPatient.latest_triage_date)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Patient Mode</label>
                      <p className="text-sm">{viewingPatient.latest_triage_mode || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Mobility</label>
                      <p className="text-sm">
                        {viewingPatient.latest_triage_mobility === "ambulatory" ? "Ambulatory (walking)" :
                         viewingPatient.latest_triage_mobility === "wheelchair" ? "Wheelchair" :
                         viewingPatient.latest_triage_mobility === "stretcher" ? "Stretcher" :
                         viewingPatient.latest_triage_mobility || "-"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Chief Complaint</label>
                      <p className="text-sm">{viewingPatient.latest_triage_complaint || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Temperature (°C)</label>
                      <p className="text-sm">{viewingPatient.latest_temperature || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Heart Rate (bpm)</label>
                      <p className="text-sm">{viewingPatient.latest_heart_rate || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Blood Pressure</label>
                      <p className="text-sm">
                        {viewingPatient.latest_systolic && viewingPatient.latest_diastolic
                          ? `${viewingPatient.latest_systolic}/${viewingPatient.latest_diastolic} mmHg`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Respiratory Rate</label>
                      <p className="text-sm">{viewingPatient.latest_respiratory_rate || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">SpO2 (%)</label>
                      <p className="text-sm">{viewingPatient.latest_spo2 || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">AVPU</label>
                      <p className="text-sm">
                        {viewingPatient.latest_avpu === "A" ? "A - Alert" :
                         viewingPatient.latest_avpu === "V" ? "V - Voice responsive" :
                         viewingPatient.latest_avpu === "P" ? "P - Pain responsive" :
                         viewingPatient.latest_avpu === "U" ? "U - Unresponsive" :
                         viewingPatient.latest_avpu || "-"}
                      </p>
                    </div>
                    {viewingPatient.latest_weight && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Weight (kg)</label>
                        <p className="text-sm">{viewingPatient.latest_weight} kg</p>
                      </div>
                    )}
                    </div>
                    
                    {/* Pain Assessment */}
                  {viewingPatient.latest_pain_level !== null && viewingPatient.latest_pain_level !== undefined && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Pain Assessment</h4>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Pain Level</label>
                        <p className="text-sm">
                          {viewingPatient.latest_pain_level}/10
                          <span className="ml-2 text-xs text-muted-foreground">
                            {viewingPatient.latest_pain_level === 0 ? "(No pain)" :
                             viewingPatient.latest_pain_level <= 3 ? "(Mild)" :
                             viewingPatient.latest_pain_level <= 6 ? "(Moderate)" :
                             "(Severe)"}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Obstetric Indicators */}
                  {(viewingPatient.latest_is_pregnant || viewingPatient.latest_is_postpartum) && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Obstetric Indicators</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {viewingPatient.latest_is_pregnant && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Pregnant</label>
                            <p className="text-sm">
                              <Badge variant="default">Yes</Badge>
                              {viewingPatient.latest_pregnancy_weeks && (
                                <span className="ml-2 text-sm">({viewingPatient.latest_pregnancy_weeks} weeks)</span>
                              )}
                            </p>
                          </div>
                        )}
                        {viewingPatient.latest_is_postpartum && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Postpartum</label>
                            <p className="text-sm">
                              <Badge variant="default">Yes</Badge>
                              {viewingPatient.latest_postpartum_days && (
                                <span className="ml-2 text-sm">({viewingPatient.latest_postpartum_days} days)</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Trauma Indicators */}
                  {viewingPatient.latest_has_trauma && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Trauma Indicators</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Trauma Present</label>
                          <p className="text-sm"><Badge variant="destructive">Yes</Badge></p>
                        </div>
                        {viewingPatient.latest_trauma_type && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Trauma Type</label>
                            <p className="text-sm">
                              {viewingPatient.latest_trauma_type === "blunt" ? "Blunt trauma" :
                               viewingPatient.latest_trauma_type === "penetrating" ? "Penetrating trauma" :
                               viewingPatient.latest_trauma_type === "burns" ? "Burns" :
                               viewingPatient.latest_trauma_type === "fall" ? "Fall from height" :
                               viewingPatient.latest_trauma_type === "rta" ? "Road traffic accident" :
                               viewingPatient.latest_trauma_type === "other" ? "Other" :
                               viewingPatient.latest_trauma_type}
                            </p>
                          </div>
                        )}
                        {viewingPatient.latest_trauma_mechanism && (
                          <div className="col-span-2">
                            <label className="text-sm font-medium text-muted-foreground">Trauma Mechanism</label>
                            <p className="text-sm">{viewingPatient.latest_trauma_mechanism}</p>
                          </div>
                        )}
                        {viewingPatient.latest_burns_percentage !== null && viewingPatient.latest_burns_percentage !== undefined && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Burn Surface Area</label>
                            <p className="text-sm mt-1">{viewingPatient.latest_burns_percentage}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Clinical Discriminators */}
                  {(viewingPatient.latest_has_respiratory_distress || viewingPatient.latest_has_chest_pain || viewingPatient.latest_has_severe_bleeding) && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Clinical Discriminators</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {viewingPatient.latest_has_respiratory_distress && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Respiratory Distress</label>
                            <p className="text-sm"><Badge variant="destructive">Yes</Badge></p>
                          </div>
                        )}
                        {viewingPatient.latest_has_chest_pain && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Chest Pain</label>
                            <p className="text-sm"><Badge variant="destructive">Yes</Badge></p>
                          </div>
                        )}
                        {viewingPatient.latest_has_severe_bleeding && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Severe Bleeding</label>
                            <p className="text-sm"><Badge variant="destructive">Yes</Badge></p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No triage records available</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete patient{" "}
              <strong>
                {selectedPatient?.first_name} {selectedPatient?.last_name}
              </strong>{" "}
              ({formatPatientNumber(selectedPatient?.patient_number)})? This action cannot be undone and will permanently
              remove all patient records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>) : 'Load More'}
          </Button>
        </div>
      )}
    </>
  )
}







