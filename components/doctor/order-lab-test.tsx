"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useLab } from "@/lib/lab-context"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export function OrderLabTest({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (o:boolean)=>void }) {
  const { orderTest } = useLab()
  const [search, setSearch] = useState("")
  const [catalog, setCatalog] = useState<any[]>([])
  const [selected, setSelected] = useState<any[]>([])
  const [priority, setPriority] = useState("Routine")
  const [specimenType, setSpecimenType] = useState("Blood")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const load = async () => {
      if (!search.trim()) { setCatalog([]); return }
      const res = await fetch(`/api/lab-catalog?q=${encodeURIComponent(search)}`, { signal: ctrl.signal, credentials: "include" }).catch(()=>null)
      if (!res || !res.ok) return
      const data = await res.json().catch(()=> ({}))
      setCatalog(Array.isArray(data.items) ? data.items : [])
    }
    const t = setTimeout(load, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [search])

  const addTest = (item:any) => {
    if (selected.find((s)=> s.loincCode === item.loincCode)) return
    setSelected((prev)=> [...prev, item])
  }

  const removeTest = (code:string) => {
    setSelected((prev)=> prev.filter((t)=> t.loincCode !== code))
  }

  const submit = async () => {
    if (!selected.length) return
    setSaving(true)
    try {
      await orderTest({
        patientId,
        priority,
        specimenType,
        notes,
        tests: selected.map((t)=> ({
          loincCode: t.loincCode,
          testName: t.name,
          testType: t.class || "Lab",
          specimenType,
          priority,
        })),
      })
      onOpenChange(false)
      setSelected([])
      setSearch("")
      setNotes("")
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
            <Label>Search LOINC Catalog</Label>
            <Input placeholder="Type test name or LOINC code" value={search} onChange={(e)=> setSearch(e.target.value)} />
            {catalog.length > 0 && (
              <ScrollArea className="max-h-56 rounded-md border">
                <div className="p-2 space-y-2">
                  {catalog.map((item)=> (
                    <div key={item.loincCode} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0">
                      <div className="text-sm">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.loincCode} · {item.component} · {item.property} · {item.system}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={()=> addTest(item)}>Add</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {selected.length > 0 && (
            <div className="space-y-2">
              <Label>Selected tests</Label>
              <div className="flex flex-wrap gap-2">
                {selected.map((t)=> (
                  <Badge key={t.loincCode} variant="secondary" className="flex items-center gap-1">
                    {t.name}
                    <button aria-label="Remove" onClick={()=> removeTest(t.loincCode)} className="ml-1 text-xs">×</button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Clinical Notes</Label>
            <Input placeholder="Reason for test, symptoms, etc." value={notes} onChange={(e)=> setNotes(e.target.value)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=> onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !selected.length}>{saving? 'Ordering...':'Order Test(s)'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
