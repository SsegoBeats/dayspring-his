"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, Scan } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type WorkflowPrefs = {
  defaultModality: string
  autoClaimOnOpen: boolean
  statAlertSound: boolean
  enforceStructuredReports: boolean
  showPreviousStudiesDefault: boolean
  overdueThresholdHours: number
}

const DEFAULTS: WorkflowPrefs = {
  defaultModality: "any",
  autoClaimOnOpen: false,
  statAlertSound: true,
  enforceStructuredReports: false,
  showPreviousStudiesDefault: false,
  overdueThresholdHours: 24,
}

export function RadiologistWorkflowSettings() {
  const [prefs, setPrefs] = useState<WorkflowPrefs>(DEFAULTS)
  const [original, setOriginal] = useState<WorkflowPrefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/preferences", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { preferences?: { radiologistWorkflow?: Partial<WorkflowPrefs> } }) => {
        const stored = data?.preferences?.radiologistWorkflow
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
        body: JSON.stringify({ radiologistWorkflow: prefs }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setOriginal(prefs)
      toast.success("Workflow preferences saved")
    } catch {
      toast.error("Failed to save workflow preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-[linear-gradient(135deg,#062032_0%,#0a3d52_100%)] text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <Scan className="h-4 w-4 text-sky-300" />
          <CardTitle className="text-base text-white">Radiology Workflow</CardTitle>
        </div>
        <CardDescription className="text-sky-100/70">
          Imaging defaults, auto-claim behaviour, structured report enforcement, and alert preferences.
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
                <Label htmlFor="defaultModality">Default Modality Filter</Label>
                <Select
                  value={prefs.defaultModality}
                  onValueChange={(value) => setPrefs((prev) => ({ ...prev, defaultModality: value }))}
                >
                  <SelectTrigger id="defaultModality">
                    <SelectValue placeholder="Any modality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any modality</SelectItem>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="CT Scan">CT Scan</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="Mammography">Mammography</SelectItem>
                    <SelectItem value="Fluoroscopy">Fluoroscopy</SelectItem>
                    <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                    <SelectItem value="PET Scan">PET Scan</SelectItem>
                    <SelectItem value="Angiography">Angiography</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Pre-selects this modality filter when you open the worklist.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overdueThreshold">Overdue Threshold</Label>
                <Select
                  value={String(prefs.overdueThresholdHours)}
                  onValueChange={(value) => setPrefs((prev) => ({ ...prev, overdueThresholdHours: Number(value) }))}
                >
                  <SelectTrigger id="overdueThreshold">
                    <SelectValue placeholder="24 hours" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 hours (strict)</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours (standard)</SelectItem>
                    <SelectItem value="48">48 hours (relaxed)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Studies older than this turn amber/red in the queue.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-claim on open</Label>
                  <p className="text-xs text-muted-foreground">Automatically assigns you to a study when you open it.</p>
                </div>
                <Switch
                  checked={prefs.autoClaimOnOpen}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, autoClaimOnOpen: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">STAT alert sound</Label>
                  <p className="text-xs text-muted-foreground">Play an alert when a new STAT study notification arrives.</p>
                </div>
                <Switch
                  checked={prefs.statAlertSound}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, statAlertSound: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Enforce structured reports</Label>
                  <p className="text-xs text-muted-foreground">Block submission if required template sections are missing (applies to all modalities, not just CT/MRI).</p>
                </div>
                <Switch
                  checked={prefs.enforceStructuredReports}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, enforceStructuredReports: checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Show prior studies by default</Label>
                  <p className="text-xs text-muted-foreground">Expand previous radiology studies panel automatically when opening a case.</p>
                </div>
                <Switch
                  checked={prefs.showPreviousStudiesDefault}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, showPreviousStudiesDefault: checked }))}
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
