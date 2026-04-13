"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, Stethoscope, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface Procedure {
  id: string
  procedure_name: string
  procedure_type: string
  status: string
  ordered_at: string
  completed_at?: string
  ordered_by_name?: string
  completed_by_name?: string
  notes?: string
}

interface ProceduresViewProps {
  patientId: string
}

export function ProceduresView({ patientId }: ProceduresViewProps) {
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadProcedures = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/procedures?patientId=${patientId}`, {
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to load procedures')
      const data = await res.json()
      setProcedures(data.procedures || [])
    } catch (error) {
      console.error('Failed to load procedures:', error)
      toast.error('Failed to load procedures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientId) void loadProcedures()
  }, [patientId])

  const handleComplete = async () => {
    if (!selectedProcedure) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/procedures', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureId: selectedProcedure.id,
          notes: completionNotes.trim() || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to mark procedure as completed')
      }

      toast.success('Procedure marked as completed')
      setCompleteDialogOpen(false)
      setCompletionNotes('')
      setSelectedProcedure(null)
      await loadProcedures()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to complete procedure')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>
      case 'ordered':
        return <Badge variant="secondary">Ordered</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading procedures...</p>
  }

  if (procedures.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            No procedures ordered for this patient.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Procedure</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>Ordered By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => (
            <TableRow key={proc.id}>
              <TableCell className="font-medium">{proc.procedure_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{proc.procedure_type}</TableCell>
              <TableCell className="text-sm">
                {new Date(proc.ordered_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm">{proc.ordered_by_name || '—'}</TableCell>
              <TableCell>{getStatusBadge(proc.status)}</TableCell>
              <TableCell>
                {proc.status === 'ordered' && (
                  <Dialog open={completeDialogOpen && selectedProcedure?.id === proc.id} onOpenChange={(open) => {
                    setCompleteDialogOpen(open)
                    if (!open) setSelectedProcedure(null)
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProcedure(proc)
                          setCompletionNotes(proc.notes || '')
                        }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Complete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Complete Procedure</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <p className="text-sm font-medium">Procedure: {proc.procedure_name}</p>
                          <p className="text-xs text-muted-foreground">Type: {proc.procedure_type}</p>
                        </div>
                        <div>
                          <Label htmlFor="completion-notes">Completion Notes (optional)</Label>
                          <Textarea
                            id="completion-notes"
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            placeholder="Any observations or notes about the procedure"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleComplete} disabled={submitting}>
                          {submitting ? 'Saving...' : 'Mark as Completed'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {proc.status === 'completed' && proc.completed_at && (
                  <div className="text-xs text-muted-foreground">
                    <p>Completed: {new Date(proc.completed_at).toLocaleString()}</p>
                    {proc.completed_by_name && <p>By: {proc.completed_by_name}</p>}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
