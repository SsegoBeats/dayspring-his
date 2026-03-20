"use client"

import { useState, useEffect } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Pill, Bell, Printer, ClipboardList, RotateCcw } from "lucide-react"
import { toast } from "sonner"

interface FormState {
  low_stock_threshold_override: string
  expiry_warning_days: string
  expiry_critical_days: string
  default_dispensing_notes: string
  preferred_print_format: string
  print_include_logo: boolean
  notify_low_stock: boolean
  notify_expiry: boolean
  notify_new_prescriptions: boolean
  notify_po_approved: boolean
}

const DEFAULT_FORM: FormState = {
  low_stock_threshold_override: "",
  expiry_warning_days: "90",
  expiry_critical_days: "30",
  default_dispensing_notes: "",
  preferred_print_format: "a4",
  print_include_logo: true,
  notify_low_stock: true,
  notify_expiry: true,
  notify_new_prescriptions: true,
  notify_po_approved: true,
}

export function PharmacyPreferencesSettings() {
  const { pharmacySettings, refreshPharmacySettings, updatePharmacySettings } = usePharmacy()
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pharmacySettings) {
      refreshPharmacySettings()
    }
  }, [pharmacySettings, refreshPharmacySettings])

  useEffect(() => {
    if (!pharmacySettings) return
    setForm({
      low_stock_threshold_override:
        pharmacySettings.low_stock_threshold_override != null
          ? String(pharmacySettings.low_stock_threshold_override)
          : "",
      expiry_warning_days: String(pharmacySettings.expiry_warning_days ?? 90),
      expiry_critical_days: String(pharmacySettings.expiry_critical_days ?? 30),
      default_dispensing_notes: pharmacySettings.default_dispensing_notes ?? "",
      preferred_print_format: pharmacySettings.preferred_print_format ?? "a4",
      print_include_logo: pharmacySettings.print_include_logo ?? true,
      notify_low_stock: pharmacySettings.notify_low_stock ?? true,
      notify_expiry: pharmacySettings.notify_expiry ?? true,
      notify_new_prescriptions: pharmacySettings.notify_new_prescriptions ?? true,
      notify_po_approved: pharmacySettings.notify_po_approved ?? true,
    })
  }, [pharmacySettings])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updatePharmacySettings({
        low_stock_threshold_override:
          form.low_stock_threshold_override !== ""
            ? Number(form.low_stock_threshold_override)
            : undefined,
        expiry_warning_days: Number(form.expiry_warning_days || 90),
        expiry_critical_days: Number(form.expiry_critical_days || 30),
        default_dispensing_notes: form.default_dispensing_notes || undefined,
        preferred_print_format: form.preferred_print_format,
        print_include_logo: form.print_include_logo,
        notify_low_stock: form.notify_low_stock,
        notify_expiry: form.notify_expiry,
        notify_new_prescriptions: form.notify_new_prescriptions,
        notify_po_approved: form.notify_po_approved,
      })
      toast.success("Pharmacy preferences saved")
    } catch (err: any) {
      const msg = err?.message || "Failed to save preferences"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    setForm(DEFAULT_FORM)
  }

  return (
    <Card className="overflow-hidden rounded-[28px] border-sky-100/80 bg-white/90 shadow-[0_28px_80px_-54px_rgba(14,116,144,0.42)] backdrop-blur">
      <CardHeader className="border-b border-sky-100/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,0.92))]">
        <CardTitle className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-blue-600" />
          Pharmacy Preferences
        </CardTitle>
        <CardDescription>
          Configure stock alerts, dispensing defaults, print settings, and notification preferences for this portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-6">

        {/* Section 1: Stock Alerts */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Stock Alerts</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="low_stock_threshold_override">
                Low Stock Threshold Override
                <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="low_stock_threshold_override"
                type="number"
                min={0}
                placeholder="Use medication defaults"
                value={form.low_stock_threshold_override}
                onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold_override: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 bg-white/95"
              />
              <p className="text-xs text-muted-foreground">Leave blank to use per-medication reorder levels.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_warning_days">Expiry Warning Days</Label>
              <Input
                id="expiry_warning_days"
                type="number"
                min={1}
                max={365}
                value={form.expiry_warning_days}
                onChange={(e) => setForm((f) => ({ ...f, expiry_warning_days: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 bg-white/95"
              />
              <p className="text-xs text-muted-foreground">Warn when medication expires within this many days.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_critical_days">Expiry Critical Days</Label>
              <Input
                id="expiry_critical_days"
                type="number"
                min={1}
                max={365}
                value={form.expiry_critical_days}
                onChange={(e) => setForm((f) => ({ ...f, expiry_critical_days: e.target.value }))}
                className="h-11 rounded-2xl border-slate-200 bg-white/95"
              />
              <p className="text-xs text-muted-foreground">Critical alert threshold (shown in red).</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 2: Dispensing Defaults */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Dispensing Defaults</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_dispensing_notes">
              Default Dispensing Notes
              <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="default_dispensing_notes"
              rows={3}
              placeholder="e.g. Take with food. Keep out of reach of children."
              value={form.default_dispensing_notes}
              onChange={(e) => setForm((f) => ({ ...f, default_dispensing_notes: e.target.value }))}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
            <p className="text-xs text-muted-foreground">Pre-filled on new dispense forms. Can be overridden per dispense.</p>
          </div>
        </div>

        <Separator />

        {/* Section 3: Print Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Print Preferences</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preferred_print_format">Preferred Print Format</Label>
              <Select
                value={form.preferred_print_format}
                onValueChange={(val) => setForm((f) => ({ ...f, preferred_print_format: val }))}
              >
                <SelectTrigger id="preferred_print_format" className="h-11 rounded-2xl border-slate-200 bg-white/95">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="a5">A5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 md:self-end">
              <div>
                <Label htmlFor="print_include_logo">Include Logo on Prints</Label>
                <p className="text-sm text-muted-foreground">Show hospital logo on dispensing labels and receipts.</p>
              </div>
              <Switch
                id="print_include_logo"
                checked={form.print_include_logo}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, print_include_logo: checked }))}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 4: Notification Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Notification Preferences</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <div>
                <Label htmlFor="notify_low_stock">Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">Notify when a medication falls below its reorder level.</p>
              </div>
              <Switch
                id="notify_low_stock"
                checked={form.notify_low_stock}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, notify_low_stock: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <div>
                <Label htmlFor="notify_expiry">Expiry Alerts</Label>
                <p className="text-sm text-muted-foreground">Notify when medications are approaching their expiry date.</p>
              </div>
              <Switch
                id="notify_expiry"
                checked={form.notify_expiry}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, notify_expiry: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <div>
                <Label htmlFor="notify_new_prescriptions">New Prescriptions</Label>
                <p className="text-sm text-muted-foreground">Notify when a new prescription is queued for dispensing.</p>
              </div>
              <Switch
                id="notify_new_prescriptions"
                checked={form.notify_new_prescriptions}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, notify_new_prescriptions: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
              <div>
                <Label htmlFor="notify_po_approved">Purchase Order Approved</Label>
                <p className="text-sm text-muted-foreground">Notify when a purchase order is approved for fulfillment.</p>
              </div>
              <Switch
                id="notify_po_approved"
                checked={form.notify_po_approved}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, notify_po_approved: checked }))}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center justify-between gap-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDefaults}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[170px] rounded-2xl">
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
