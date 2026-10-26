"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Clock3, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"

interface WorkflowRoute {
  id: string
  patient_id: string
  checkin_id: string | null
  from_department: string | null
  to_department: string
  reason: string | null
  priority: string | null
  status: "Pending" | "Acknowledged"
  created_at: string
  acknowledged_at: string | null
  patient_number: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string
}

export function PatientWorkflowBoard() {
  const { user } = useAuth()
  const [routes, setRoutes] = useState<WorkflowRoute[]>([])
  const [destinations, setDestinations] = useState<string[]>([])
  const [selectedDestinations, setSelectedDestinations] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyRouteId, setBusyRouteId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/patient-workflow", { credentials: "include" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not load patient handoffs")
      setRoutes(Array.isArray(data.routes) ? data.routes : [])
      setDestinations(Array.isArray(data.destinations) ? data.destinations : [])
      setLoadError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load patient handoffs"
      setLoadError(message)
      throw error
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      try {
        await load()
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Could not load patient handoffs")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [load])

  const acknowledge = async (route: WorkflowRoute) => {
    setBusyRouteId(route.id)
    try {
      const response = await fetch("/api/patient-workflow", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routingId: route.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not acknowledge handoff")
      toast.success("Patient handoff acknowledged")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not acknowledge handoff")
    } finally {
      setBusyRouteId(null)
    }
  }

  const handoff = async (route: WorkflowRoute) => {
    const toDepartment = selectedDestinations[route.id]
    if (!toDepartment) {
      toast.error("Choose the next department")
      return
    }
    setBusyRouteId(route.id)
    try {
      const response = await fetch("/api/patient-workflow", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routingId: route.id,
          toDepartment,
          reason: reasons[route.id]?.trim() || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not route patient")
      toast.success(toDepartment === "Discharged" ? "Patient visit discharged" : `Patient routed to ${toDepartment}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not route patient")
    } finally {
      setBusyRouteId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shared Patient Flow</h1>
          <p className="text-sm text-muted-foreground">
            Review arrivals for your department and hand off the same patient visit to the next service.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => load().catch((error) => toast.error(error instanceof Error ? error.message : "Could not load patient handoffs"))}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading patient handoffs…</CardContent></Card>
      ) : loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load patient handoffs</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : routes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No patients waiting</CardTitle>
            <CardDescription>New reception check-ins and department transfers will appear here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {routes.map((route) => (
            <Card key={route.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      {route.first_name} {route.last_name}
                    </CardTitle>
                    <CardDescription>
                      {route.patient_number} · {route.gender}
                      {route.date_of_birth ? ` · DOB ${new Date(route.date_of_birth).toLocaleDateString()}` : ""}
                    </CardDescription>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
                    {route.priority || "Standard"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{route.from_department || "Reception"}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{route.to_department}</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {new Date(route.created_at).toLocaleString()}
                  </span>
                </div>
                {route.reason && <p className="text-sm text-muted-foreground">{route.reason}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {user?.role && ["Clinician", "Nurse", "Midwife", "Dentist", "Radiologist", "Hospital Admin"].includes(user.role) && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/medical-history/${route.patient_id}`}>Open patient record</Link>
                    </Button>
                  )}
                  {route.status === "Pending" && (
                    <Button size="sm" variant="secondary" onClick={() => acknowledge(route)} disabled={busyRouteId === route.id}>
                      <Check className="mr-2 h-4 w-4" />
                      Acknowledge
                    </Button>
                  )}
                  <select
                    aria-label={`Next department for ${route.first_name} ${route.last_name}`}
                    className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedDestinations[route.id] || ""}
                    onChange={(event) => setSelectedDestinations((current) => ({ ...current, [route.id]: event.target.value }))}
                  >
                    <option value="">Select next department</option>
                    {destinations.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                  <input
                    aria-label={`Handoff note for ${route.first_name} ${route.last_name}`}
                    className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Handoff note (optional)"
                    maxLength={1000}
                    value={reasons[route.id] || ""}
                    onChange={(event) => setReasons((current) => ({ ...current, [route.id]: event.target.value }))}
                  />
                  <Button size="sm" onClick={() => handoff(route)} disabled={busyRouteId === route.id}>
                    {busyRouteId === route.id ? "Saving…" : "Transfer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Signed in as {user?.name || "staff"}. Patient information is shown according to your assigned role.
      </p>
    </div>
  )
}
