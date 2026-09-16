"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { HeartHandshake } from "lucide-react"
import { toast } from "sonner"

function MidwifePreferences() {
  const [eddMethod, setEddMethod] = useState("naegele")
  const [eddAlertWeeks, setEddAlertWeeks] = useState("4")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/preferences", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { preferences?: { midwifePrefs?: { eddMethod?: string; eddAlertWeeks?: number } } }) => {
        const stored = data?.preferences?.midwifePrefs
        if (stored) {
          if (stored.eddMethod) setEddMethod(stored.eddMethod)
          if (stored.eddAlertWeeks != null) setEddAlertWeeks(String(stored.eddAlertWeeks))
        }
      })
      .catch(() => {})
  }, [])

  async function save() {
    const weeks = parseInt(eddAlertWeeks, 10)
    if (isNaN(weeks) || weeks < 1 || weeks > 12) {
      toast.error("EDD alert threshold must be between 1 and 12 weeks")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          midwifePrefs: {
            eddMethod,
            eddAlertWeeks: weeks,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Failed to save")
      }
      toast.success("Obstetric preferences saved")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border border-rose-100 shadow-sm shadow-rose-100/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">Obstetric Preferences</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Configure EDD calculation and alert thresholds for your ANC workflow
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="edd-method" className="text-xs font-medium text-slate-600">
            EDD calculation method
          </Label>
          <Select value={eddMethod} onValueChange={setEddMethod}>
            <SelectTrigger id="edd-method" className="focus:ring-rose-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="naegele">
                Naegele&apos;s Rule (LMP + 280 days)
              </SelectItem>
              <SelectItem value="ultrasound">
                Ultrasound dating (CRL / BPD)
              </SelectItem>
              <SelectItem value="lmp_28">
                LMP + 280 days (28-day cycle assumed)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400">
            Determines how the system calculates and displays estimated delivery dates in ANC records.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="edd-alert-weeks" className="text-xs font-medium text-slate-600">
            Upcoming delivery alert threshold (weeks)
          </Label>
          <Input
            id="edd-alert-weeks"
            name="eddAlertWeeks"
            type="number"
            min={1}
            max={12}
            value={eddAlertWeeks}
            onChange={(e) => setEddAlertWeeks(e.target.value)}
            className="w-32 focus-visible:ring-rose-400"
          />
          <p className="text-xs text-slate-400">
            Patients with EDD within this many weeks are shown in the &quot;Upcoming Deliveries&quot; stat on the Overview tab.
          </p>
        </div>

        <Button
          onClick={save}
          disabled={saving}
          className="bg-rose-600 hover:bg-rose-700 text-white"
          size="sm"
        >
          {saving ? "Saving…" : "Save obstetric preferences"}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function MidwifeSettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    if ((user.role || "").toLowerCase() !== "midwife") {
      router.replace("/settings")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  if ((user.role || "").toLowerCase() !== "midwife") {
    return null
  }

  return (
    <SettingsLayout
      title="Midwifery Settings"
      description="Manage your midwifery practice settings and patient care preferences"
      icon={<HeartHandshake className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <ProfileSettings />
            <MidwifePreferences />
            <PreferenceSettings />
          </>
        }
        secondary={
          <>
            <EmailSettings />
            <PasswordSettings />
            <NotificationSettings />
          </>
        }
      />
    </SettingsLayout>
  )
}
