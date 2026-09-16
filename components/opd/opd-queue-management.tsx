"use client"

import { useState, useEffect } from "react"
import { useFormatDate } from "@/lib/date-utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Clock, AlertCircle, Stethoscope, CheckCircle, User } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface OPDQueuePatient {
  id: string
  patient_id: string
  patient_number: string
  patient_name: string
  triage_category: "Emergency" | "Very Urgent" | "Urgent" | "Routine"
  chief_complaint: string
  recorded_at: string
  avpu: string
  temperature: number | null
  heart_rate: number | null
  systolic: number | null
  diastolic: number | null
  spo2: number | null
  pain_level: number
  status: "triage" | "consultation" | "treatment" | "discharged"
}

export function OPDQueueManagement() {
  const { formatDate } = useFormatDate()
  const [patients, setPatients] = useState<OPDQueuePatient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  useEffect(() => {
    fetchQueue()
    // Refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchQueue = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/opd/queue", {
        credentials: "include",
      })
      
      if (!response.ok) {
        throw new Error("Failed to fetch OPD queue")
      }

      const data = await response.json()
      setPatients(data.patients || [])
    } catch (err) {
      console.error("Error fetching OPD queue:", err)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (patientId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/opd/queue/status?triageId=${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus, triageId: patientId }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      await fetchQueue()
    } catch (err) {
      console.error("Error updating status:", err)
    }
  }

  // Sort patients by triage priority
  const sortByPriority = (a: OPDQueuePatient, b: OPDQueuePatient) => {
    const priority: Record<string, number> = {
      Emergency: 1,
      "Very Urgent": 2,
      Urgent: 3,
      Routine: 4,
    }
    
    if (priority[a.triage_category] !== priority[b.triage_category]) {
      return priority[a.triage_category] - priority[b.triage_category]
    }
    
    // If same priority, sort by time
    return new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  }

  const filteredPatients = patients
    .filter((p) => {
      const matchesSearch =
        p.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.patient_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || p.status === statusFilter
      const matchesCategory = categoryFilter === "all" || p.triage_category === categoryFilter
      
      return matchesSearch && matchesStatus && matchesCategory
    })
    .sort(sortByPriority)

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Emergency":
        return "destructive"
      case "Very Urgent":
        return "destructive"
      case "Urgent":
        return "default"
      default:
        return "secondary"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "discharged":
        return "default"
      case "treatment":
        return "default"
      case "consultation":
        return "secondary"
      default:
        return "outline"
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return formatDate(date)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading OPD queue...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OPD Patient Queue</CardTitle>
        <CardDescription>
          Manage patient flow from triage through consultation to discharge
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or complaint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="triage">Triage</SelectItem>
              <SelectItem value="consultation">Consultation</SelectItem>
              <SelectItem value="treatment">Treatment</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="Very Urgent">Very Urgent</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="Routine">Routine</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Queue Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Chief Complaint</TableHead>
                <TableHead>Vitals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Wait Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No patients in queue
                  </TableCell>
                </TableRow>
              ) : (
                filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Badge variant={getCategoryColor(patient.triage_category)}>
                        {patient.triage_category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{patient.patient_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {patient.patient_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {patient.chief_complaint}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {patient.temperature && (
                          <div>Temp: {patient.temperature}°C</div>
                        )}
                        {patient.heart_rate && (
                          <div>HR: {patient.heart_rate} bpm</div>
                        )}
                        {patient.systolic && patient.diastolic && (
                          <div>BP: {patient.systolic}/{patient.diastolic}</div>
                        )}
                        {patient.spo2 && (
                          <div>SpO2: {patient.spo2}%</div>
                        )}
                        {patient.pain_level > 0 && (
                          <div>Pain: {patient.pain_level}/10</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(patient.status)}>
                        {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTime(patient.recorded_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {patient.status === "triage" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(patient.id, "consultation")}
                          >
                            <Stethoscope className="h-3 w-3 mr-1" />
                            Consult
                          </Button>
                        )}
                        {patient.status === "consultation" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(patient.id, "treatment")}
                          >
                            Treat
                          </Button>
                        )}
                        {patient.status === "treatment" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateStatus(patient.id, "discharged")}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Discharge
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredPatients.length} of {patients.length} patients
        </div>
      </CardContent>
    </Card>
  )
}
