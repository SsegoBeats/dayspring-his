"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useLab } from "@/lib/lab-context"

export function OrderLabTest({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (o:boolean)=>void }) {
  const { orderTest } = useLab()
  const [testName, setTestName] = useState("")
  const [testType, setTestType] = useState("Hematology")
  const [priority, setPriority] = useState("Routine")
  const [specimenType, setSpecimenType] = useState("Blood")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!testName.trim()) return
    setSaving(true)
    try {
      await orderTest({ patientId, testName, testType, priority, specimenType, notes })
      onOpenChange(false)
      setTestName(""); setNotes("")
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Order Laboratory Test</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Test Name</Label>
            <Input placeholder="e.g. Complete Blood Count (CBC)" value={testName} onChange={(e)=> setTestName(e.target.value)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hematology">Hematology</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                  <SelectItem value="Serology">Serology</SelectItem>
                  <SelectItem value="Microbiology">Microbiology</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Specimen</Label>
              <Select value={specimenType} onValueChange={setSpecimenType}>
                <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Blood">Blood</SelectItem>
                  <SelectItem value="Serum">Serum</SelectItem>
                  <SelectItem value="Plasma">Plasma</SelectItem>
                  <SelectItem value="Urine">Urine</SelectItem>
                  <SelectItem value="Stool">Stool</SelectItem>
                  <SelectItem value="Sputum">Sputum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Clinical Notes</Label>
            <Input placeholder="Reason for test, symptoms, etc." value={notes} onChange={(e)=> setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=> onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !testName.trim()}>{saving? 'Ordering...':'Order Test'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

