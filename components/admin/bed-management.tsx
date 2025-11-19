"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bed, Plus, Edit, Trash2, Users, Activity, UserPlus, Search, Filter, X, ChevronDown, ChevronUp, SortAsc, SortDesc, Eye, BarChart3 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"

interface Bed {
  id: string
  bedNumber: string
  ward: string
  bedType: string
  status: string
  location: string
  equipment: string[]
  notes: string
  assignmentId?: string
  patient?: {
    id: string
    name: string
    patientNumber: string
    assignedAt: string
  } | null
  lastAssignment?: {
    status: string
    assignedAt: string
    dischargeDate?: string
    patientName?: string
  } | null
  createdAt: string
  updatedAt: string
}

interface BedSummary {
  total: number
  occupied: number
  available: number
  maintenance: number
  reserved: number
  occupancyRate: number
  totalWards: number
}

interface WardBreakdown {
  ward: string
  totalBeds: number
  occupiedBeds: number
  occupancyRate: number
}

const BED_TYPES = [
  "Standard",
  "ICU",
  "Emergency", 
  "Surgical",
  "Pediatric",
  "Maternity",
  "Isolation"
]

const BED_STATUSES = [
  "Available",
  "Occupied", 
  "Maintenance",
  "Reserved"
]

const COMMON_WARDS = [
  "Emergency",
  "ICU",
  "Medical",
  "Surgical", 
  "Pediatric",
  "Maternity",
  "Isolation",
  "Cardiology",
  "Neurology",
  "Oncology"
]

const COMMON_EQUIPMENT = [
  "Oxygen",
  "IV Stand",
  "Monitor",
  "Ventilator",
  "IV Pump",
  "Air Purifier",
  "Child Monitor",
  "Baby Monitor"
]

export function BedManagement() {
  const { user } = useAuth()
  const [beds, setBeds] = useState<Bed[]>([])
  const [summary, setSummary] = useState<BedSummary>({
    total: 0,
    occupied: 0,
    available: 0,
    maintenance: 0,
    reserved: 0,
    occupancyRate: 0,
    totalWards: 0
  })
  const [wardBreakdown, setWardBreakdown] = useState<WardBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [editingBed, setEditingBed] = useState<Bed | null>(null)
  const [assigningBed, setAssigningBed] = useState<Bed | null>(null)
  const [detailsBed, setDetailsBed] = useState<Bed | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // Assignment dialog state
  const [patientSearch, setPatientSearch] = useState("")
  const [patientResults, setPatientResults] = useState<Array<{ id: string; name: string; patient_number: string }>>([])
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string; patient_number: string } | null>(null)
  const [assignmentNotes, setAssignmentNotes] = useState("")

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState({
    status: "",
    ward: "",
    bedType: "",
    equipment: "",
    hasPatient: ""
  })
  const [sortBy, setSortBy] = useState<"bedNumber" | "ward" | "status" | "bedType" | "createdAt">("bedNumber")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)

  // Role-based permissions
  const canAddBeds = user?.role === 'Hospital Admin'
  const canEditBeds = user?.role === 'Hospital Admin' || user?.role === 'Nurse'
  const canDeleteBeds = user?.role === 'Hospital Admin'
  const canAssignPatients = user?.role === 'Nurse'
  const canViewBeds = user?.role === 'Hospital Admin' || user?.role === 'Nurse' || user?.role === 'Receptionist'

  // Form state
  const [formData, setFormData] = useState({
    bedNumber: "",
    ward: "",
    bedType: "",
    location: "",
    equipment: [] as string[],
    notes: ""
  })

  const fetchBeds = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.ward) params.set('ward', filters.ward)
      if (filters.status) params.set('status', filters.status)
      if (filters.bedType) params.set('bedType', filters.bedType)
      if (filters.hasPatient) params.set('hasPatient', filters.hasPatient)
      const qs = params.toString()
      const response = await fetch(`/api/beds${qs ? `?${qs}` : ''}`, { credentials: "include" })
      if (response.ok) {
        const data = await response.json()
        setBeds(data.beds || [])
        setSummary(data.summary || summary)
        setWardBreakdown(data.wardBreakdown || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch bed data",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error fetching beds:", error)
      toast({
        title: "Error", 
        description: "Failed to fetch bed data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBeds()
  }, [filters.status, filters.ward, filters.bedType, filters.hasPatient])

  // Populate form when editing a bed
  useEffect(() => {
    if (editingBed) {
      setFormData({
        bedNumber: editingBed.bedNumber,
        ward: editingBed.ward,
        bedType: editingBed.bedType,
        location: editingBed.location,
        equipment: editingBed.equipment,
        notes: editingBed.notes
      })
    }
  }, [editingBed])

  const handleAddBed = async () => {
    try {
      const response = await fetch("/api/beds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bed added successfully"
        })
        setIsAddDialogOpen(false)
        resetForm()
        fetchBeds()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to add bed",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error adding bed:", error)
      toast({
        title: "Error",
        description: "Failed to add bed",
        variant: "destructive"
      })
    }
  }

  const handleEditBed = async () => {
    if (!editingBed) return

    try {
      const response = await fetch(`/api/beds/${editingBed.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          status: editingBed.status
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bed updated successfully"
        })
        setIsEditDialogOpen(false)
        setEditingBed(null)
        resetForm()
        fetchBeds()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update bed",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error updating bed:", error)
      toast({
        title: "Error",
        description: "Failed to update bed",
        variant: "destructive"
      })
    }
  }

  const handleAssignPatient = async (bedId: string, patientId: string) => {
    try {
      const response = await fetch("/api/beds/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          bedId,
          patientId,
          assignedBy: user?.id,
          notes: assignmentNotes || "Patient assigned to bed"
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Patient assigned to bed successfully"
        })
        setIsAssignDialogOpen(false)
        setAssigningBed(null)
        fetchBeds()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to assign patient",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error assigning patient:", error)
      toast({
        title: "Error",
        description: "Failed to assign patient",
        variant: "destructive"
      })
    }
  }

  const handleDeleteBed = async (bedId: string) => {
    if (!confirm("Are you sure you want to delete this bed?")) return

    try {
      const response = await fetch(`/api/beds/${bedId}`, {
        method: "DELETE",
        credentials: "include"
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bed deleted successfully"
        })
        fetchBeds()
      } else {
        toast({
          title: "Error",
          description: "Failed to delete bed",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error deleting bed:", error)
      toast({
        title: "Error",
        description: "Failed to delete bed",
        variant: "destructive"
      })
    }
  }

  // Load assignment history for details view
  useEffect(() => {
    const run = async () => {
      if (!detailsOpen || !detailsBed) return
      setHistoryLoading(true)
      try {
        const res = await fetch(`/api/beds/assignments?bedId=${detailsBed.id}&status=all`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setHistory(data.assignments || [])
        }
      } finally {
        setHistoryLoading(false)
      }
    }
    run()
  }, [detailsOpen, detailsBed])

  const handleDischarge = async (assignmentId?: string, notes?: string) => {
    if (!assignmentId) return
    try {
      const res = await fetch('/api/beds/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignmentId, status: 'Discharged', notes })
      })
      if (!res.ok) throw new Error('Failed to discharge')
      toast({ title: 'Success', description: 'Patient discharged and bed freed' })
      fetchBeds()
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to discharge patient', variant: 'destructive' })
    }
  }

  // Fetch and filter patients for assignment search (client-side filter over GET)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!isAssignDialogOpen || patientSearch.trim().length < 2) {
        setPatientResults([])
        return
      }
      try {
        const params = new URLSearchParams({ q: patientSearch, limit: '8', compact: '1' })
        const res = await fetch(`/api/patients?${params.toString()}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const list = (data.patients || []).map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          patient_number: p.patient_number,
        }))
        if (!cancelled) setPatientResults(list)
      } catch {
        if (!cancelled) setPatientResults([])
      }
    }
    const t = setTimeout(run, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [isAssignDialogOpen, patientSearch])

  const resetForm = () => {
    setFormData({
      bedNumber: "",
      ward: "",
      bedType: "",
      location: "",
      equipment: [],
      notes: ""
    })
  }

  // Filter and sort beds
  const filteredAndSortedBeds = useMemo(() => {
    let filtered = beds.filter(bed => {
      // Search term filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || 
        bed.bedNumber.toLowerCase().includes(searchLower) ||
        bed.ward.toLowerCase().includes(searchLower) ||
        bed.location.toLowerCase().includes(searchLower) ||
        bed.patient?.name.toLowerCase().includes(searchLower) ||
        bed.patient?.patientNumber.toLowerCase().includes(searchLower)

      // Status filter
      const matchesStatus = !filters.status || bed.status === filters.status

      // Ward filter
      const matchesWard = !filters.ward || bed.ward === filters.ward

      // Bed type filter
      const matchesBedType = !filters.bedType || bed.bedType === filters.bedType

      // Equipment filter
      const matchesEquipment = !filters.equipment || 
        bed.equipment.some(eq => eq.toLowerCase().includes(filters.equipment.toLowerCase()))

      // Patient assignment filter
      const matchesPatient = !filters.hasPatient || 
        (filters.hasPatient === "assigned" && bed.patient) ||
        (filters.hasPatient === "unassigned" && !bed.patient)

      return matchesSearch && matchesStatus && matchesWard && matchesBedType && matchesEquipment && matchesPatient
    })

    // Sort beds
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case "bedNumber":
          aValue = a.bedNumber
          bValue = b.bedNumber
          break
        case "ward":
          aValue = a.ward
          bValue = b.ward
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "bedType":
          aValue = a.bedType
          bValue = b.bedType
          break
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          aValue = a.bedNumber
          bValue = b.bedNumber
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      } else {
        return sortOrder === "asc" ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
      }
    })

    return filtered
  }, [beds, searchTerm, filters, sortBy, sortOrder])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedBeds.length / itemsPerPage)
  const paginatedBeds = filteredAndSortedBeds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filters, sortBy, sortOrder])

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setFilters({
      status: "",
      ward: "",
      bedType: "",
      equipment: "",
      hasPatient: ""
    })
    setSortBy("bedNumber")
    setSortOrder("asc")
  }

  // Get unique values for filter options
  const uniqueWards = useMemo(() => [...new Set(beds.map(bed => bed.ward))], [beds])
  const uniqueBedTypes = useMemo(() => [...new Set(beds.map(bed => bed.bedType))], [beds])
  const allEquipment = useMemo(() => {
    const equipmentSet = new Set<string>()
    beds.forEach(bed => bed.equipment.forEach(eq => equipmentSet.add(eq)))
    return Array.from(equipmentSet)
  }, [beds])

  const activeFilters = useMemo(() => {
    const pills: Array<{ label: string; value: string; onClear: () => void }> = []
    if (filters.status) pills.push({ label: 'Status', value: filters.status, onClear: () => setFilters({ ...filters, status: '' }) })
    if (filters.ward) pills.push({ label: 'Ward', value: filters.ward, onClear: () => setFilters({ ...filters, ward: '' }) })
    if (filters.bedType) pills.push({ label: 'Type', value: filters.bedType, onClear: () => setFilters({ ...filters, bedType: '' }) })
    if (filters.equipment) pills.push({ label: 'Equipment', value: filters.equipment, onClear: () => setFilters({ ...filters, equipment: '' }) })
    if (filters.hasPatient) pills.push({ label: 'Assignment', value: filters.hasPatient === 'assigned' ? 'With patient' : 'Available', onClear: () => setFilters({ ...filters, hasPatient: '' }) })
    return pills
  }, [filters])

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-800"
      case "Occupied":
        return "bg-red-100 text-red-800"
      case "Maintenance":
        return "bg-yellow-100 text-yellow-800"
      case "Reserved":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getWardBadgeColor = (ward: string) => {
    const colors = [
      "bg-purple-100 text-purple-800",
      "bg-blue-100 text-blue-800", 
      "bg-green-100 text-green-800",
      "bg-yellow-100 text-yellow-800",
      "bg-pink-100 text-pink-800",
      "bg-indigo-100 text-indigo-800",
      "bg-teal-100 text-teal-800"
    ]
    const index = COMMON_WARDS.indexOf(ward)
    return colors[index % colors.length] || "bg-gray-100 text-gray-800"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading bed data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-sm transition-shadow border-sky-100 bg-sky-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-600">Total Beds</CardTitle>
            <Bed className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Across {summary.totalWards} wards</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow border-rose-100 bg-rose-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-rose-700">Occupied</CardTitle>
            <Users className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold text-rose-700">{summary.occupied}</div>
                <p className="text-xs text-muted-foreground">{summary.occupancyRate}% occupancy rate</p>
              </div>
              <div className="relative h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-[11px] font-semibold text-rose-700">
                <span>{summary.occupancyRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow border-emerald-100 bg-emerald-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">Available</CardTitle>
            <Bed className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-emerald-700">{summary.available}</div>
            <p className="text-xs text-muted-foreground">Ready for patients</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow border-amber-100 bg-amber-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">Maintenance</CardTitle>
            <Activity className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-amber-700">{summary.maintenance}</div>
            <p className="text-xs text-muted-foreground">Under maintenance</p>
          </CardContent>
        </Card>
      </div>

      {/* Ward Breakdown */}
      {wardBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ward Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wardBreakdown.map((ward) => {
                const occupiedPct = ward.occupancyRate
                const availablePct = Math.max(0, 100 - occupiedPct)
                return (
                  <div key={ward.ward} className="p-4 border rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getWardBadgeColor(ward.ward)}>{ward.ward}</Badge>
                      <span className="text-sm font-medium">{occupiedPct}% occupied</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-2">
                      <div
                        className="h-full bg-rose-400"
                        style={{ width: `${occupiedPct}%` }}
                      />
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${availablePct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Occupied: {ward.occupiedBeds}</span>
                      <span>Available: {ward.totalBeds - ward.occupiedBeds}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter Beds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search + Actions */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by bed number, ward, location, or patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 md:mt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
              {(searchTerm || Object.values(filters).some(f => f)) && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <ExportAssignmentsMenu filters={filters} />
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={filters.status || "all"} onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {BED_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ward-filter">Ward</Label>
                <Select value={filters.ward || "all"} onValueChange={(value) => setFilters({ ...filters, ward: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Wards" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wards</SelectItem>
                    {uniqueWards.map((ward) => (
                      <SelectItem key={ward} value={ward}>{ward}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bedtype-filter">Bed Type</Label>
                <Select value={filters.bedType || "all"} onValueChange={(value) => setFilters({ ...filters, bedType: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueBedTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="equipment-filter">Equipment</Label>
                <Select value={filters.equipment || "all"} onValueChange={(value) => setFilters({ ...filters, equipment: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Equipment</SelectItem>
                    {allEquipment.map((equipment) => (
                      <SelectItem key={equipment} value={equipment}>{equipment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="patient-filter">Patient Assignment</Label>
                <Select value={filters.hasPatient || "all"} onValueChange={(value) => setFilters({ ...filters, hasPatient: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Beds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Beds</SelectItem>
                    <SelectItem value="assigned">With Patient</SelectItem>
                    <SelectItem value="unassigned">Available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Sort Controls + Filter Pills */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="sort-by">Sort by:</Label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bedNumber">Bed Number</SelectItem>
                  <SelectItem value="ward">Ward</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="bedType">Bed Type</SelectItem>
                  <SelectItem value="createdAt">Date Created</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] md:ml-auto">
                {activeFilters.map((f) => (
                  <button
                    key={`${f.label}-${f.value}`}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2 py-0.5 text-slate-700"
                    onClick={f.onClear}
                  >
                    <span className="font-medium">{f.label}:</span>
                    <span>{f.value}</span>
                    <X className="h-3 w-3 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="text-sm text-muted-foreground">
            Showing {paginatedBeds.length} of {filteredAndSortedBeds.length} beds
            {filteredAndSortedBeds.length !== beds.length && (
              <span> (filtered from {beds.length} total)</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Bed Button - Only Hospital Admin */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bed Inventory</h2>
        {canAddBeds && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Bed
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Bed</DialogTitle>
                <DialogDescription>
                  Add a new bed to your hospital's inventory. Fill in the required information below.
                </DialogDescription>
              </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bedNumber">Bed Number</Label>
                <Input
                  id="bedNumber"
                  value={formData.bedNumber}
                  onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                  placeholder="e.g., ER-001, ICU-001"
                />
              </div>
              <div>
                <Label htmlFor="ward">Ward</Label>
                <Select value={formData.ward} onValueChange={(value) => setFormData({ ...formData, ward: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ward" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_WARDS.map((ward) => (
                      <SelectItem key={ward} value={ward}>{ward}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bedType">Bed Type</Label>
                <Select value={formData.bedType} onValueChange={(value) => setFormData({ ...formData, bedType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bed type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BED_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Room 1, Bay A"
                />
              </div>
              <div>
                <Label htmlFor="equipment">Equipment (comma-separated)</Label>
                <Input
                  id="equipment"
                  value={formData.equipment.join(", ")}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value.split(",").map(item => item.trim()).filter(Boolean) })}
                  placeholder="e.g., Oxygen, IV Stand, Monitor"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddBed}>
                  Add Bed
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Edit Bed Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bed</DialogTitle>
            <DialogDescription>
              Update the bed information below. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-bedNumber">Bed Number</Label>
              <Input
                id="edit-bedNumber"
                value={formData.bedNumber}
                onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                placeholder="e.g., ER-001, ICU-001"
              />
            </div>
            <div>
              <Label htmlFor="edit-ward">Ward</Label>
              <Select value={formData.ward} onValueChange={(value) => setFormData({ ...formData, ward: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_WARDS.map((ward) => (
                    <SelectItem key={ward} value={ward}>{ward}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-bedType">Bed Type</Label>
              <Select value={formData.bedType} onValueChange={(value) => setFormData({ ...formData, bedType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bed type" />
                </SelectTrigger>
                <SelectContent>
                  {BED_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editingBed?.status || "Available"} onValueChange={(value) => {
                if (editingBed) {
                  setEditingBed({ ...editingBed, status: value })
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {BED_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Room 1, Bay A"
              />
            </div>
            <div>
              <Label htmlFor="edit-equipment">Equipment (comma-separated)</Label>
              <Input
                id="edit-equipment"
                value={formData.equipment.join(", ")}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value.split(",").map(item => item.trim()).filter(Boolean) })}
                placeholder="e.g., Oxygen, IV Stand, Monitor"
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false)
                setEditingBed(null)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button onClick={handleEditBed}>
                Update Bed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bed Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bed Details - {detailsBed?.bedNumber} ({detailsBed?.ward})</DialogTitle>
            <DialogDescription>Assignment history and metadata</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {historyLoading ? (
              <div className="text-sm text-muted-foreground">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-muted-foreground">No assignment history.</div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-auto">
                {history.map((h, i) => (
                  <div key={h.id || i} className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{h.patient?.name || 'Unknown'} <span className="text-xs text-muted-foreground">#{h.patient?.patientNumber || ''}</span></div>
                      <Badge>{h.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Assigned: {h.assignedAt ? new Date(h.assignedAt).toLocaleString() : '-'}
                      {h.dischargeDate ? ` → Discharged: ${new Date(h.dischargeDate).toLocaleString()}` : ''}
                    </div>
                    {h.notes && (
                      <div className="text-xs mt-1">Notes: {h.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Patient Assignment Dialog - Only for Nurses */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Patient to Bed</DialogTitle>
            <DialogDescription>
              Assign a patient to {assigningBed?.bedNumber} in the {assigningBed?.ward} ward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="patient-search">Search Patient</Label>
              <Input
                id="patient-search"
                placeholder="Enter patient name or number..."
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null) }}
              />
              {patientResults.length > 0 && (
                <div className="mt-2 border rounded-md max-h-48 overflow-auto bg-white dark:bg-zinc-900">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      className={`w-full text-left px-3 py-2 hover:bg-muted ${selectedPatient?.id === p.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedPatient(p)}
                    >
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.patient_number}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-2 text-sm">
                  Selected: <span className="font-medium">{selectedPatient.name}</span> ({selectedPatient.patient_number})
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="assignment-notes">Assignment Notes</Label>
              <Textarea
                id="assignment-notes"
                placeholder="Reason for bed assignment..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setIsAssignDialogOpen(false)
                setAssigningBed(null)
                setPatientSearch("")
                setPatientResults([])
                setSelectedPatient(null)
                setAssignmentNotes("")
              }}>
                Cancel
              </Button>
              <Button disabled={!assigningBed || !selectedPatient} onClick={() => {
                if (assigningBed && selectedPatient) {
                  handleAssignPatient(assigningBed.id, selectedPatient.id)
                }
              }}>
                Assign Patient
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Beds List + Legend */}
      {beds.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Bed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No beds configured</h3>
            <p className="text-muted-foreground mb-4">
              Add beds to start managing your hospital's bed inventory
            </p>
            {canAddBeds && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Bed
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredAndSortedBeds.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No beds match your search</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search terms or filters
            </p>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="font-medium text-slate-600">Status legend:</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Occupied</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Maintenance</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Reserved</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
            {paginatedBeds.map((bed) => (
            <Card
              key={bed.id}
              className={`hover:shadow-sm transition-shadow border-l-4 ${
                bed.status === 'Available'
                  ? 'border-l-emerald-500'
                  : bed.status === 'Occupied'
                  ? 'border-l-rose-500'
                  : bed.status === 'Maintenance'
                  ? 'border-l-amber-400'
                  : 'border-l-sky-500'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{bed.bedNumber}</CardTitle>
                  <div className="flex space-x-2">
                    {canEditBeds && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingBed(bed)
                          setIsEditDialogOpen(true)
                        }}
                        title="Edit bed"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDetailsBed(bed); setDetailsOpen(true) }}
                      title="View bed details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canAssignPatients && bed.status === 'Available' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssigningBed(bed)
                          setIsAssignDialogOpen(true)
                        }}
                        title="Assign patient to bed"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                    {canEditBeds && bed.patient && (
                      <DischargeButton assignmentId={bed.assignmentId} onConfirm={(notes) => handleDischarge(bed.assignmentId, notes)} />
                    )}
                    {canDeleteBeds && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteBed(bed.id)}
                        title="Delete bed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={getWardBadgeColor(bed.ward)}>
                    {bed.ward}
                  </Badge>
                  <Badge className={getStatusBadgeColor(bed.status)}>
                    {bed.status}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Type: {bed.bedType}</p>
                  <p className="text-sm text-muted-foreground">Location: {bed.location}</p>
                </div>

                {bed.equipment.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Equipment:</p>
                    <div className="flex flex-wrap gap-1">
                      {bed.equipment.map((item, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {bed.patient && (
                  <div className="p-2 bg-blue-50 rounded">
                    <p className="text-sm font-medium text-blue-800">Patient Assigned</p>
                    <p className="text-xs text-blue-600">{bed.patient.name}</p>
                    <p className="text-xs text-blue-600">#{bed.patient.patientNumber}</p>
                    <p className="text-xs text-blue-600">Assigned {new Date(bed.patient.assignedAt).toLocaleString()}</p>
                  </div>
                )}

                {!bed.patient && bed.lastAssignment && (
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">
                      Last: {bed.lastAssignment.patientName || 'Unknown'} - {new Date(bed.lastAssignment.assignedAt).toLocaleString()} {bed.lastAssignment.dischargeDate ? `→ ${new Date(bed.lastAssignment.dischargeDate).toLocaleString()}` : ''}
                    </p>
                  </div>
                )}

                {bed.notes && (
                  <p className="text-xs text-muted-foreground">{bed.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1
                    const isActive = pageNum === currentPage
                    return (
                      <Button
                        key={pageNum}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="text-muted-foreground">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 p-0"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Inline discharge confirmation component
function DischargeButton({ assignmentId, onConfirm }: { assignmentId?: string; onConfirm: (notes: string) => void }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState("")
  if (!assignmentId) return null
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Discharge patient">
        Discharge
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Discharge</DialogTitle>
            <DialogDescription>Provide optional notes and confirm discharge.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="discharge-notes">Notes</Label>
            <Textarea id="discharge-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Discharge summary, reason, etc." />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => { onConfirm(notes); setOpen(false); setNotes("") }}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExportAssignmentsMenu({ filters }: { filters: { status: string; ward: string; bedType: string; equipment: string; hasPatient: string } }) {
  const exportData = async (format: "csv" | "xlsx" | "pdf") => {
    const to = new Date().toISOString()
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const payload: any = {
      dataset: "bed_assignments",
      format,
      filters: {
        from,
        to,
        status: filters.status || "All",
        ward: filters.ward || undefined,
      },
    }
    const res = await fetch('/api/exports/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bed-assignments-${new Date().toISOString().split('T')[0]}.${format}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportData('csv')}>Export Assignments as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportData('xlsx')}>Export Assignments as Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportData('pdf')}>Export Assignments as PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

