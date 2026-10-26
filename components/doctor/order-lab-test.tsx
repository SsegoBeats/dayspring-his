"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { useLab } from "@/lib/lab-context"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface LabCatalogItem {
  loincCode: string | null
  name: string
  component?: string | null
  property?: string | null
  system?: string | null
  class?: string | null
  key?: string
}

interface Specimen {
  id: string
  name: string
  tests: LabCatalogItem[]
}

interface SpecimenCategory {
  id: string
  name: string
  specimens: Specimen[]
}

interface SpecimenOrder {
  specimen: Specimen
  tests: LabCatalogItem[]
}

export function OrderLabTest({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { orderTest } = useLab()
  const [search, setSearch] = useState("")
  const [catalog, setCatalog] = useState<LabCatalogItem[]>([])
  const [categories, setCategories] = useState<SpecimenCategory[]>([])
  const [specimenOrders, setSpecimenOrders] = useState<SpecimenOrder[]>([])
  const [activeSpecimenId, setActiveSpecimenId] = useState("")
  const [specimenToAdd, setSpecimenToAdd] = useState("")
  const [manualName, setManualName] = useState("")
  const [priority, setPriority] = useState("Routine")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [catalogMsg, setCatalogMsg] = useState("")

  const availableSpecimens = useMemo(
    () => categories.flatMap((category) => category.specimens.map((specimen) => ({
      ...specimen,
      categoryName: category.name,
    }))),
    [categories],
  )
  const activeOrder = specimenOrders.find((item) => item.specimen.id === activeSpecimenId)
  const selectedCount = specimenOrders.reduce((total, item) => total + item.tests.length, 0)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setStatusMsg("")
    fetch("/api/lab-specimens", { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to load specimen catalog")
        const loadedCategories = Array.isArray(data.categories) ? data.categories as SpecimenCategory[] : []
        setCategories(loadedCategories)
        const firstSpecimen = loadedCategories.flatMap((category) => category.specimens)[0]
        setSpecimenToAdd((current) => current || firstSpecimen?.id || "")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setStatusMsg(error instanceof Error ? error.message : "Failed to load specimen catalog")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [open])

  useEffect(() => {
    if (!search.trim()) {
      setCatalog([])
      setCatalogMsg("")
      setLoadingCatalog(false)
      return
    }
    const controller = new AbortController()
    setLoadingCatalog(true)
    setCatalogMsg("")
    const timer = setTimeout(() => {
      fetch(`/api/lab-catalog?q=${encodeURIComponent(search)}`, {
        signal: controller.signal,
        credentials: "include",
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || "Search failed")
          const items = Array.isArray(data.items) ? data.items as LabCatalogItem[] : []
          setCatalog(items)
          setCatalogMsg(items.length ? "" : "No matches found.")
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          setCatalog([])
          setCatalogMsg(error instanceof Error ? error.message : "Search failed")
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingCatalog(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const addSpecimen = () => {
    const specimen = availableSpecimens.find((item) => item.id === specimenToAdd)
    if (!specimen) return
    setSpecimenOrders((current) => current.some((item) => item.specimen.id === specimen.id)
      ? current
      : [...current, { specimen, tests: [] }])
    setActiveSpecimenId(specimen.id)
  }

  const addTest = (item: LabCatalogItem) => {
    if (!activeOrder) return
    const key = item.loincCode || item.key || `custom-${item.name.toLocaleLowerCase()}`
    setSpecimenOrders((current) => current.map((order) => {
      if (order.specimen.id !== activeSpecimenId || order.tests.some((test) => (test.loincCode || test.key || `custom-${test.name.toLocaleLowerCase()}`) === key)) {
        return order
      }
      return { ...order, tests: [...order.tests, { ...item, key }] }
    }))
  }

  const removeTest = (specimenId: string, key: string) => {
    setSpecimenOrders((current) => current.map((order) =>
      order.specimen.id === specimenId
        ? { ...order, tests: order.tests.filter((test) => (test.loincCode || test.key || `custom-${test.name.toLocaleLowerCase()}`) !== key) }
        : order,
    ))
  }

  const addManual = () => {
    const name = manualName.trim()
    if (!name || !activeOrder) return
    addTest({ loincCode: null, name, class: "Lab", key: `custom-${name.toLocaleLowerCase()}` })
    setManualName("")
  }

  const submit = async () => {
    if (!selectedCount) {
      setStatusMsg("Select at least one test before placing the order.")
      return
    }
    setSaving(true)
    setStatusMsg("")
    try {
      const result = await orderTest({
        patientId,
        priority,
        notes,
        tests: specimenOrders.flatMap((order) => order.tests.map((test) => ({
          loincCode: test.loincCode,
          testName: test.name,
          testType: test.class || "Lab",
          specimenType: order.specimen.name,
          priority,
        }))),
      })
      if (!result) {
        setStatusMsg("The tests could not be ordered. Please check your connection and try again.")
        return
      }
      onOpenChange(false)
      setSpecimenOrders([])
      setSearch("")
      setNotes("")
      setStatusMsg("")
    } catch (error) {
      setStatusMsg(error instanceof Error ? error.message : "The tests could not be ordered.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-w-[1200px] w-full max-h-[85vh] overflow-hidden px-6">
        <DialogHeader>
          <DialogTitle>Order Laboratory Tests</DialogTitle>
          <DialogDescription>Add one or more specimens, then select tests mapped to each specimen.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-h-0 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="order-specimen-select">Specimens</Label>
              <div className="flex gap-2">
                <Select value={specimenToAdd} onValueChange={setSpecimenToAdd} disabled={loading || !availableSpecimens.length}>
                  <SelectTrigger id="order-specimen-select">
                    <SelectValue placeholder={loading ? "Loading specimens…" : "Select a specimen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectGroup key={category.id}>
                        <SelectLabel>{category.name}</SelectLabel>
                        {category.specimens.map((specimen) => (
                          <SelectItem key={specimen.id} value={specimen.id}>{specimen.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addSpecimen} disabled={!specimenToAdd}>Add specimen</Button>
              </div>
              {specimenOrders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specimenOrders.map((order) => (
                    <div key={order.specimen.id} className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={activeSpecimenId === order.specimen.id ? "default" : "outline"}
                        onClick={() => setActiveSpecimenId(order.specimen.id)}
                      >
                        {order.specimen.name} ({order.tests.length})
                      </Button>
                      <button
                        type="button"
                        aria-label={`Remove ${order.specimen.name}`}
                        className="rounded px-1 text-sm text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setSpecimenOrders((current) => current.filter((item) => item.specimen.id !== order.specimen.id))
                          if (activeSpecimenId === order.specimen.id) {
                            setActiveSpecimenId(specimenOrders.find((item) => item.specimen.id !== order.specimen.id)?.specimen.id || "")
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeOrder ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Available tests for {activeOrder.specimen.name}</Label>
                  <Badge variant="secondary">{activeOrder.specimen.tests.length} mapped</Badge>
                </div>
                {activeOrder.specimen.tests.length ? (
                  <ScrollArea className="h-[34vh] rounded-md border">
                    <div className="space-y-2 p-3">
                      {activeOrder.specimen.tests.map((test) => {
                        const key = test.loincCode || test.key || test.name
                        const checked = activeOrder.tests.some((selected) => (selected.loincCode || selected.key || selected.name) === key)
                        return (
                          <label key={key} className="flex cursor-pointer items-start gap-2 rounded border-b p-2 last:border-0">
                            <Checkbox checked={checked} onCheckedChange={() => checked ? removeTest(activeOrder.specimen.id, key) : addTest(test)} />
                            <span className="min-w-0 text-sm">
                              <span className="block font-medium">{test.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {[test.loincCode, test.component, test.system].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No tests are mapped to this specimen yet. An administrator can configure its test list, or you can search the catalog below.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Add a specimen to see its available tests.
              </div>
            )}

            {specimenOrders.some((order) => order.tests.length > 0) && (
              <div className="space-y-2">
                <Label>Selected tests</Label>
                <div className="flex flex-wrap gap-2">
                  {specimenOrders.flatMap((order) => order.tests.map((test) => {
                    const key = test.loincCode || test.key || test.name
                    return (
                      <Badge key={`${order.specimen.id}-${key}`} variant="secondary" className="flex items-center gap-1">
                        {test.name} · {order.specimen.name}
                        <button type="button" aria-label={`Remove ${test.name}`} onClick={() => removeTest(order.specimen.id, key)} className="ml-1 text-xs">×</button>
                      </Badge>
                    )
                  }))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="order-lab-notes">Clinical Notes</Label>
              <Input id="order-lab-notes" name="clinicalNotes" placeholder="Reason for test, symptoms, etc." value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statusMsg && <p role="alert" className="text-sm text-destructive">{statusMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !selectedCount}>{saving ? "Ordering…" : "Order Test(s)"}</Button>
            </div>
          </div>

          <div className="min-h-0 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="lab-catalog-search">Search LOINC Catalog</Label>
              <Input id="lab-catalog-search" placeholder="Type test name or LOINC code" value={search} onChange={(event) => setSearch(event.target.value)} />
              {!activeOrder && <p className="text-xs text-muted-foreground">Add a specimen before selecting catalog tests.</p>}
              {loadingCatalog && <div className="text-xs text-muted-foreground">Searching…</div>}
              {catalog.length > 0 && (
                <div className="h-[45vh] rounded-md border bg-white/95">
                  <ScrollArea className="h-full">
                    <div className="space-y-3 p-3">
                      {catalog.map((item) => (
                        <div key={item.loincCode} className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
                          <div className="min-w-0 flex-1 overflow-hidden text-sm leading-snug">
                            <div className="break-words font-medium">{item.name}</div>
                            <div className="line-clamp-2 break-words text-xs text-muted-foreground">
                              {[item.loincCode, item.component, item.property, item.system].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={!activeOrder} onClick={() => addTest(item)}>Add</Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {!loadingCatalog && catalogMsg && <div role="status" className="text-xs text-muted-foreground">{catalogMsg}</div>}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Can’t find it? Add a custom test name for the selected specimen.</div>
              <div className="flex gap-2">
                <Input
                  id="order-lab-manual-name"
                  name="manualTestName"
                  placeholder="Custom test name"
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addManual()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addManual} disabled={!manualName.trim() || !activeOrder}>Add</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
