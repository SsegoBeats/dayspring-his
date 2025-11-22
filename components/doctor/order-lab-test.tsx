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
  const [manualName, setManualName] = useState("")
  const [priority, setPriority] = useState("Routine")
  const [specimenType, setSpecimenType] = useState("Blood")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")

  useEffect(() => {
    const ctrl = new AbortController()
    const load = async () => {
      if (!search.trim()) { setCatalog([]); setStatusMsg(""); return }
      setLoading(true)
      setStatusMsg("")
      const res = await fetch(`/api/lab-catalog?q=${encodeURIComponent(search)}`, { signal: ctrl.signal, credentials: "include" }).catch(()=>null)
      if (!res || !res.ok) {
        setCatalog([])
        setStatusMsg("Search failed. Check network or session.")
        setLoading(false)
        return
      }
      const data = await res.json().catch(()=> ({}))
      const items = Array.isArray(data.items) ? data.items : []
      setCatalog(items)
      if (!items.length) setStatusMsg("No matches found. Try another term or add a custom test.")
      else setStatusMsg("")
      setLoading(false)
    }
    const t = setTimeout(load, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [search])

  const addTest = (item:any) => {
    if (selected.find((s)=> s.loincCode === item.loincCode)) return
    setSelected((prev)=> [...prev, item])
  }

  const addManual = () => {
    const name = manualName.trim()
    if (!name) return
    setSelected((prev)=> [...prev, { loincCode: null, name, class: "Lab" }])
    setManualName("")
  }

  const removeTest = (code:string | null) => {
    setSelected((prev)=> prev.filter((t)=> t.loincCode !== code || (code === null && t.loincCode !== null)))
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
      <DialogContent className="sm:max-w-[1200px] max-w-[1200px] w-full max-h-[85vh] overflow-hidden px-6">
        <DialogHeader>
          <DialogTitle>Order Laboratory Test</DialogTitle>
        </DialogHeader>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="space-y-4">
            {selected.length > 0 && (
              <div className="space-y-2">
                <Label>Selected tests</Label>
                <div className="flex flex-wrap gap-2">
                  {selected.map((t, idx)=> (
                    <Badge key={`${t.loincCode || 'custom'}-${idx}`} variant="secondary" className="flex items-center gap-1">
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
            <div className="grid md:grid-cols-2 gap-3">
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !selected.length}>{saving? 'Ordering...':'Order Test(s)'}</Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Search LOINC Catalog</Label>
              <Input placeholder="Type test name or LOINC code" value={search} onChange={(e)=> setSearch(e.target.value)} />
              {loading && <div className="text-xs text-muted-foreground">Searching…</div>}
              {catalog.length > 0 && (
                <div className="rounded-md border bg-white/95">
                  <ScrollArea className="max-h-[70vh]">
                    <div className="p-3 space-y-3">
                      {catalog.map((item)=> (
                        <div key={item.loincCode} className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
                          <div className="text-sm leading-snug overflow-hidden flex-1 min-w-0">
                            <div className="font-medium break-words">{item.name}</div>
                            <div className="text-xs text-muted-foreground break-words line-clamp-2">
                              {item.loincCode} · {item.component} · {item.property} · {item.system}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="shrink-0" onClick={()=> addTest(item)}>Add</Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {!loading && statusMsg && <div className="text-xs text-muted-foreground">{statusMsg}</div>}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Can’t find it? Add a custom test name below.</div>
              <div className="flex gap-2">
                <Input placeholder="Custom test name" value={manualName} onChange={(e)=> setManualName(e.target.value)} />
                <Button variant="outline" onClick={addManual} disabled={!manualName.trim()}>Add</Button>
              </div>
              <div className="text-xs text-muted-foreground">Quick picks:</div>
              <div className="flex flex-wrap gap-2">
                {["Complete blood count (CBC)", "Basic metabolic panel", "Comprehensive metabolic panel", "Liver function tests", "Renal panel", "CRP", "ESR", "Malaria RDT", "HIV rapid", "Urinalysis", "Troponin", "D-Dimer"].map((q)=> (
                  <Button key={q} size="sm" variant="secondary" onClick={()=> setSearch(q)}>{q}</Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
