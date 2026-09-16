"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { useLab } from "@/lib/lab-context"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

const SPECIMEN_OPTIONS = ["Blood", "Serum", "Plasma", "Urine", "Stool", "Sputum", "Swab", "CSF"]

interface LabCatalogItem {
  loincCode: string | null
  name: string
  component?: string
  property?: string
  system?: string
  class?: string
}

export function OrderLabTest({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (o:boolean)=>void }) {
  const { orderTest } = useLab()
  const [search, setSearch] = useState("")
  const [catalog, setCatalog] = useState<LabCatalogItem[]>([])
  const [selected, setSelected] = useState<LabCatalogItem[]>([])
  const [manualName, setManualName] = useState("")
  const [priority, setPriority] = useState("Routine")
  const [specimenTypes, setSpecimenTypes] = useState<string[]>(["Blood"])
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
    const t = setTimeout(() => { void load() }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [search])

  const addTest = (item: LabCatalogItem) => {
    if (selected.find((s)=> s.loincCode === item.loincCode)) return
    setSelected((prev)=> [...prev, item])
  }

  const addManual = () => {
    const name = manualName.trim()
    if (!name) return
    setSelected((prev): LabCatalogItem[] => [...prev, { loincCode: null, name, class: "Lab" }])
    setManualName("")
  }

  const removeTest = (code:string | null) => {
    setSelected((prev)=> prev.filter((t)=> t.loincCode !== code || (code === null && t.loincCode !== null)))
  }

  const submit = async () => {
    if (!selected.length) return
    setSaving(true)
    try {
      const specimenType = specimenTypes.join(", ") || "Blood"
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
      setSpecimenTypes(["Blood"])
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-w-[1200px] w-full max-h-[85vh] overflow-hidden px-6">
        <DialogHeader>
          <DialogTitle>Order Laboratory Test</DialogTitle>
          <DialogDescription>Select lab tests from the catalog, add clinical notes, and submit the order for this patient.</DialogDescription>
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
              <Input id="order-lab-notes" name="clinicalNotes" placeholder="Reason for test, symptoms, etc." value={notes} onChange={(e)=> setNotes(e.target.value)} />
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
              <div className="space-y-1 col-span-2">
                <Label>Specimen (select one or more)</Label>
                {specimenTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {specimenTypes.map((s) => (
                      <Badge key={s} variant="secondary" className="flex items-center gap-1 text-xs">
                        {s}
                        <button aria-label={`Remove ${s}`} onClick={() => setSpecimenTypes((prev) => prev.filter((x) => x !== s))} className="ml-0.5 text-xs">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {SPECIMEN_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <Checkbox
                        id={`specimen-${opt}`}
                        checked={specimenTypes.includes(opt)}
                        onCheckedChange={(checked) =>
                          setSpecimenTypes((prev) =>
                            checked ? [...prev, opt] : prev.filter((x) => x !== opt)
                          )
                        }
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !selected.length}>{saving? 'Ordering...':'Order Test(s)'}</Button>
            </div>
          </div>

          <div className="space-y-3 min-h-0">
            <div className="space-y-2">
              <Label>Search LOINC Catalog</Label>
              <Input placeholder="Type test name or LOINC code" value={search} onChange={(e)=> setSearch(e.target.value)} />
              {loading && <div className="text-xs text-muted-foreground">Searching…</div>}
              {catalog.length > 0 && (
                <div className="rounded-md border bg-white/95 h-[70vh]">
                  <ScrollArea className="h-full">
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
                <Input id="order-lab-manual-name" name="manualTestName" placeholder="Custom test name" value={manualName} onChange={(e)=> setManualName(e.target.value)} />
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
