"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { FlaskConical, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SpecimenTest {
  loincCode: string
  name: string
  component?: string | null
  property?: string | null
  system?: string | null
  class?: string | null
}

interface SpecimenConfig {
  id: string
  name: string
  tests: SpecimenTest[]
}

interface CategoryConfig {
  id: string
  name: string
  specimens: SpecimenConfig[]
}

export function LabSpecimenSettings() {
  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const [selectedSpecimenId, setSelectedSpecimenId] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [specimenName, setSpecimenName] = useState("")
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<SpecimenTest[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  const specimens = useMemo(
    () => categories.flatMap((category) => category.specimens.map((specimen) => ({
      ...specimen,
      categoryName: category.name,
    }))),
    [categories],
  )
  const selectedSpecimen = specimens.find((specimen) => specimen.id === selectedSpecimenId)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/lab-specimens", { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to load specimen configuration")
        const loaded = Array.isArray(data.categories) ? data.categories as CategoryConfig[] : []
        setCategories(loaded)
        setSelectedSpecimenId(loaded.flatMap((category) => category.specimens)[0]?.id || "")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        toast.error(error instanceof Error ? error.message : "Failed to load specimen configuration")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      fetch(`/api/lab-catalog?q=${encodeURIComponent(search)}&limit=20`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || "Test search failed")
          setSearchResults(Array.isArray(data.items) ? data.items as SpecimenTest[] : [])
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          setSearchResults([])
          toast.error(error instanceof Error ? error.message : "Test search failed")
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const updateCategory = (categoryId: string, update: Partial<CategoryConfig>) => {
    setCategories((current) => current.map((category) =>
      category.id === categoryId ? { ...category, ...update } : category,
    ))
  }

  const updateSpecimen = (specimenId: string, update: Partial<SpecimenConfig>) => {
    setCategories((current) => current.map((category) => ({
      ...category,
      specimens: category.specimens.map((specimen) =>
        specimen.id === specimenId ? { ...specimen, ...update } : specimen,
      ),
    })))
  }

  const addCategory = () => {
    const name = categoryName.trim()
    if (!name) return
    setCategories((current) => [...current, { id: window.crypto.randomUUID(), name, specimens: [] }])
    setCategoryName("")
  }

  const addSpecimen = (categoryId: string) => {
    const name = specimenName.trim()
    if (!name) return
    const id = window.crypto.randomUUID()
    setCategories((current) => current.map((category) =>
      category.id === categoryId
        ? { ...category, specimens: [...category.specimens, { id, name, tests: [] }] }
        : category,
    ))
    setSelectedSpecimenId(id)
    setSpecimenName("")
  }

  const toggleTest = (test: SpecimenTest, checked: boolean) => {
    if (!selectedSpecimen) return
    const nextTests = checked
      ? [...selectedSpecimen.tests.filter((item) => item.loincCode !== test.loincCode), test]
      : selectedSpecimen.tests.filter((item) => item.loincCode !== test.loincCode)
    updateSpecimen(selectedSpecimen.id, { tests: nextTests })
  }

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/lab-specimens", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            specimens: category.specimens.map((specimen) => ({
              id: specimen.id,
              name: specimen.name,
              loincCodes: specimen.tests.map((test) => test.loincCode),
            })),
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save specimen configuration")
      toast.success("Specimen categories and test mappings saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save specimen configuration")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="rounded-t-xl border-b border-violet-900/30 bg-[linear-gradient(135deg,#24134a_0%,#4c1d95_100%)] text-white">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-200" />
          <CardTitle className="text-base text-white">Specimen Categories &amp; Test Mappings</CardTitle>
        </div>
        <CardDescription className="text-violet-100/80">
          Configure specimen groups and the LOINC tests that can be ordered for each specimen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading specimen catalog…
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                aria-label="New specimen category"
                placeholder="New category name"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addCategory()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCategory} disabled={!categoryName.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add category
              </Button>
            </div>

            <div className="space-y-4">
              {categories.map((category) => (
                <section key={category.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Category name"
                      value={category.name}
                      onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${category.name} category`}
                      onClick={() => {
                        setCategories((current) => current.filter((item) => item.id !== category.id))
                        if (category.specimens.some((item) => item.id === selectedSpecimenId)) setSelectedSpecimenId("")
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {category.specimens.map((specimen) => (
                      <div key={specimen.id} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={selectedSpecimenId === specimen.id ? "secondary" : "ghost"}
                          className="min-w-0 flex-1 justify-start"
                          onClick={() => setSelectedSpecimenId(specimen.id)}
                        >
                          <span className="truncate">{specimen.name}</span>
                          <Badge variant="outline" className="ml-auto">{specimen.tests.length} tests</Badge>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${specimen.name}`}
                          onClick={() => {
                            updateCategory(category.id, { specimens: category.specimens.filter((item) => item.id !== specimen.id) })
                            if (selectedSpecimenId === specimen.id) setSelectedSpecimenId("")
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      aria-label={`New specimen in ${category.name}`}
                      placeholder="New specimen name"
                      value={specimenName}
                      onChange={(event) => setSpecimenName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addSpecimen(category.id)
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => addSpecimen(category.id)} disabled={!specimenName.trim()}>
                      <Plus className="mr-1 h-4 w-4" /> Add specimen
                    </Button>
                  </div>
                </section>
              ))}
            </div>

            <div className="space-y-3 border-t pt-5">
              <div className="space-y-2">
                <Label htmlFor="mapping-specimen">Test mappings</Label>
                <Select value={selectedSpecimenId} onValueChange={setSelectedSpecimenId} disabled={!specimens.length}>
                  <SelectTrigger id="mapping-specimen">
                    <SelectValue placeholder="Select a specimen to configure" />
                  </SelectTrigger>
                  <SelectContent>
                    {specimens.map((specimen) => (
                      <SelectItem key={specimen.id} value={specimen.id}>
                        {specimen.categoryName} · {specimen.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSpecimen && (
                <>
                  <Input
                    aria-label="Search LOINC tests to map"
                    placeholder="Search test name or LOINC code"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {searching && <p className="text-xs text-muted-foreground">Searching catalog…</p>}
                  {search.length >= 2 && !searching && searchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground">No LOINC tests found.</p>
                  )}
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                    {searchResults.map((test) => (
                      <label key={test.loincCode} className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted/50">
                        <Checkbox
                          checked={selectedSpecimen.tests.some((item) => item.loincCode === test.loincCode)}
                          onCheckedChange={(checked) => toggleTest(test, checked === true)}
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-medium">{test.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[test.loincCode, test.component, test.system].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSpecimen.tests.map((test) => (
                      <Badge key={test.loincCode} variant="secondary">{test.name}</Badge>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={save} disabled={saving || !categories.length || !specimens.length}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save specimen catalog
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
