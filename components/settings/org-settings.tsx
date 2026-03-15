"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useSettings } from "@/lib/settings-context"
import { ORG_NAME, ORG_EMAIL, ORG_PHONE, ORG_ADDRESS } from "@/lib/org-constants"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

export function OrgSettings() {
  const { refreshSettings } = useSettings()
  const [currency, setCurrency] = useState("UGX")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/settings/org", { credentials: "include" })
        if (!res.ok) throw new Error("Failed to load org settings")
        const data = await res.json()
        const s = data.settings || {}
        setCurrency(s.currency || "UGX")
      } catch (e: any) {
        toast.error("Failed to load organization settings", { description: e?.message || "Error" })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/org", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({} as any)))?.error || "Failed")
      toast.success("Currency setting saved")
      await refreshSettings()
    } catch (e: any) {
      toast.error("Failed to save currency setting", { description: e?.message || "Error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="overflow-hidden rounded-[28px] border-sky-100/80 bg-white/90 shadow-[0_28px_80px_-52px_rgba(14,116,144,0.55)] backdrop-blur">
      <CardHeader className="border-b border-sky-100/70 bg-[linear-gradient(180deg,rgba(240,249,255,0.95),rgba(255,255,255,0.9))]">
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>Manage system-wide organization settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <Alert className="border-sky-100 bg-sky-50/70 text-slate-700">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Organization details (name, logo, email, phone, address) are system-managed and cannot be changed through
            this interface. Only the system currency can be modified.
          </AlertDescription>
        </Alert>

        <div className="space-y-5 border-t border-slate-200/80 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Organization Name</Label>
              <div className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">{ORG_NAME}</div>
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <div className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">{ORG_EMAIL}</div>
            </div>
            <div>
              <Label className="text-sm font-medium">Phone</Label>
              <div className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">{ORG_PHONE}</div>
            </div>
            <div>
              <Label className="text-sm font-medium">Address</Label>
              <div className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">{ORG_ADDRESS}</div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200/80 pt-5">
            <Label>System Currency</Label>
            <p className="text-xs text-muted-foreground">
              Admin-only. Affects receipts, exports, billing, and the entire system.
            </p>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white/90">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX (Ugandan Shilling)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || loading} className="min-w-[150px] rounded-2xl">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
