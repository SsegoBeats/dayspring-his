"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { FlaskConical, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export type LabTechWorkflowPrefs = {
  overdueThresholdHours: number
  autoAssignOnOpen: boolean
  statAlertSound: boolean
  defaultExportFormat: "csv" | "xlsx" | "pdf"
  defaultSpecimenCategory: string
  requireSpecimenBeforeStart: boolean
  showPriorResultsDefault: boolean
}

const DEFAULTS: LabTechWorkflowPrefs = {
  overdueThresholdHours: 4,
  autoAssignOnOpen: true,
  statAlertSound: true,
  defaultExportFormat: "xlsx",
  defaultSpecimenCategory: "any",
  requireSpecimenBeforeStart: true,
  showPriorResultsDefault: false,
}

export function LabTechWorkflowSettings() {
  const [prefs, setPrefs] = useState<LabTechWorkflowPrefs>(DEFAULTS)
  const [original, setOriginal] = useState<LabTechWorkflowPrefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/preferences", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { preferences?: { labTechWorkflow?: Partial<LabTechWorkflowPrefs> } }) => {
        const stored = data?.preferences?.labTechWorkflow
        if (stored && typeof stored === "object") {
          const merged = { ...DEFAULTS, ...stored }
          setPrefs(merged)
          setOriginal(merged)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(original)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labTechWorkflow: prefs }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setOriginal(prefs)
      toast.success("Lab workflow preferences saved")
    } catch {
      toast.error("Failed to save workflow preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="rounded-t-xl border-b border-cyan-900/30 bg-[linear-gradient(135deg,#062032_0%,#0a3d52_100%)] text-white">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-cyan-300" />
          <CardTitle className="text-base text-white">Lab Workflow</CardTitle>
        </div>
        <CardDescription className="text-cyan-100/70">
          Collection defaults, auto-assign behaviour, STAT alerts, and export preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="overdueThreshold">Overdue Threshold</Label>
                <Select
                  value={String(prefs.overdueThresholdHours)}
                  onValueChange={(value) => setPrefs((prev) => ({ ...prev, overdueThresholdHours: Number(value) }))}
                >
                  <SelectTrigger id="overdueThreshold">
                    <SelectValue placeholder="4 hours" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 hours (strict)</SelectItem>
                    <SelectItem value="4">4 hours (default)</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="12">12 hours (relaxed)</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Pending tests older than this appear in the Priority Bench.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultExportFormat">Default Export Format</Label>
                <Select
                  value={prefs.defaultExportFormat}
                  onValueChange={(value: "csv" | "xlsx" | "pdf") => setPrefs((prev) => ({ ...prev, defaultExportFormat: value }))}
                >
                  <SelectTrigger id="defaultExportFormat">
                    <SelectValue placeholder="XLSX" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV — plain text, universal</SelectItem>
                    <SelectItem value="xlsx">Excel (XLSX) — with branding &amp; flags</SelectItem>
                    <SelectItem value="pdf">PDF — formatted, printable</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Pre-selects this format in the Export Studio.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultSpecimenCategory">Default Specimen Category</Label>
                <Select
                  value={prefs.defaultSpecimenCategory}
                  onValueChange={(value) => setPrefs((prev) => ({ ...prev, defaultSpecimenCategory: value }))}
                >
                  <SelectTrigger id="defaultSpecimenCategory">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any specimen</SelectItem>
                    <SelectItem value="Blood">Blood</SelectItem>
                    <SelectItem value="Urine">Urine</SelectItem>
                    <SelectItem value="Stool">Stool</SelectItem>
                    <SelectItem value="Swab">Swab</SelectItem>
                    <SelectItem value="CSF">CSF</SelectItem>
                    <SelectItem value="Sputum">Sputum</SelectItem>
                    <SelectItem value="Tissue">Tissue biopsy</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Pre-fills the specimen type field on collection start.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-assign on open</Label>
                  <p className="text-xs text-muted-foreground">Automatically assigns you to a test when you open it for processing.</p>
                </div>
                <Switch
                  checked={prefs.autoAssignOnOpen}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, autoAssignOnOpen: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">STAT alert sound</Label>
                  <p className="text-xs text-muted-foreground">Play an alert tone when a new STAT test notification arrives.</p>
                </div>
                <Switch
                  checked={prefs.statAlertSound}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, statAlertSound: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Require specimen type before collection</Label>
                  <p className="text-xs text-muted-foreground">Block the &ldquo;Start Collection&rdquo; button until a specimen type is entered.</p>
                </div>
                <Switch
                  checked={prefs.requireSpecimenBeforeStart}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, requireSpecimenBeforeStart: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Show prior results by default</Label>
                  <p className="text-xs text-muted-foreground">Expand the patient&apos;s previous lab results automatically when opening a test.</p>
                </div>
                <Switch
                  checked={prefs.showPriorResultsDefault}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, showPriorResultsDefault: checked }))}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={!isDirty || saving} size="sm">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Workflow Preferences
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
