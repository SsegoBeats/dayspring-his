"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Bell, Palette, Globe } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "next-themes"
import { useSettings } from "@/lib/settings-context"

export function ProfileSettings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    department: "",
    signature: ""
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/settings/profile", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile({
              name: data.profile.name || "",
              phone: data.profile.phone || "",
              department: data.profile.department || "",
              signature: data.profile.signature || ""
            })
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      }
    }
    fetchProfile()
  }, [])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile)
      })
      
      if (res.ok) {
        toast.success("Profile updated successfully")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update profile")
      }
    } catch (error) {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          Profile Information
        </CardTitle>
        <CardDescription>
          Update your personal information and professional details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name"
              name="name"
              autoComplete="name"
              value={profile.name}
              onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={profile.phone}
              onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+256 700 000 000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select 
              name="department"
              value={profile.department} 
              onValueChange={(value) => setProfile(prev => ({ ...prev, department: value }))}
            >
              <SelectTrigger id="department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="cardiology">Cardiology</SelectItem>
                <SelectItem value="pediatrics">Pediatrics</SelectItem>
                <SelectItem value="surgery">Surgery</SelectItem>
                <SelectItem value="radiology">Radiology</SelectItem>
                <SelectItem value="laboratory">Laboratory</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
                <SelectItem value="administration">Administration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signature">Digital Signature</Label>
            <Input 
              id="signature"
              name="signature"
              autoComplete="organization"
              value={profile.signature}
              onChange={(e) => setProfile(prev => ({ ...prev, signature: e.target.value }))}
              placeholder="Dr. John Smith"
            />
          </div>
        </div>

        {/* Queue thresholds belong in preferences; moved to PreferenceSettings */}

        <Button onClick={saveProfile} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    emailReminders: true,
    appointmentAlerts: true,
    labResults: true,
    systemUpdates: false,
    emergencyAlerts: true
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/settings/notifications", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data.notifications) {
            setNotifications(data.notifications)
          }
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
      }
    }
    fetchNotifications()
  }, [])

  const saveNotifications = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(notifications)
      })
      
      if (res.ok) {
        toast.success("Notification preferences updated")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update notifications")
      }
    } catch (error) {
      toast.error("Failed to update notifications")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to be notified about important events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emailReminders">Email Reminders</Label>
              <p className="text-sm text-gray-600">Receive email notifications for appointments and tasks</p>
            </div>
            <Switch 
              id="emailReminders"
              name="emailReminders"
              checked={notifications.emailReminders}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailReminders: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="appointmentAlerts">Appointment Alerts</Label>
              <p className="text-sm text-gray-600">Get notified about upcoming appointments</p>
            </div>
            <Switch 
              id="appointmentAlerts"
              name="appointmentAlerts"
              checked={notifications.appointmentAlerts}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, appointmentAlerts: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="labResults">Lab Results</Label>
              <p className="text-sm text-gray-600">Notifications when lab results are ready</p>
            </div>
            <Switch 
              id="labResults"
              name="labResults"
              checked={notifications.labResults}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, labResults: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="systemUpdates">System Updates</Label>
              <p className="text-sm text-gray-600">General system announcements and updates</p>
            </div>
            <Switch 
              id="systemUpdates"
              name="systemUpdates"
              checked={notifications.systemUpdates}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, systemUpdates: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emergencyAlerts">Emergency Alerts</Label>
              <p className="text-sm text-gray-600">Critical alerts that require immediate attention</p>
            </div>
            <Switch 
              id="emergencyAlerts"
              name="emergencyAlerts"
              checked={notifications.emergencyAlerts}
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emergencyAlerts: checked }))}
            />
          </div>
        </div>

        <Button onClick={saveNotifications} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function PreferenceSettings() {
  const { setTheme } = useTheme()
  const previewedRef = (typeof window !== 'undefined' ? (window as any) : {}).__prefPreviewRef || { current: false }
  if (typeof window !== 'undefined') { (window as any).__prefPreviewRef = previewedRef }
  const { refreshSettings } = useSettings()
  const [preferences, setPreferences] = useState({
    theme: "system",
    locale: "en-GB",
    timezone: "Africa/Kampala",
    currency: "UGX",
    dateFormat: "DD/MM/YYYY",
    defaultDashboard: "overview",
    queue_wait_warn: 30,
    queue_wait_crit: 60,
    service_warn: 30,
    service_crit: 60,
  })
  const [originalPreferences, setOriginalPreferences] = useState({
    theme: "system",
    locale: "en-GB",
    timezone: "Africa/Kampala",
    currency: "UGX"
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/settings/preferences", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data.preferences) {
            const fetchedPreferences = {
              theme: data.preferences.theme || "system",
              locale: data.preferences.locale || "en-GB",
              timezone: data.preferences.timezone || "Africa/Kampala",
              currency: data.preferences.currency || "UGX",
              dateFormat: data.preferences.dateFormat || "DD/MM/YYYY",
              defaultDashboard: data.preferences.defaultDashboard || "overview",
              queue_wait_warn: Number(data.preferences.queue_wait_warn ?? 30),
              queue_wait_crit: Number(data.preferences.queue_wait_crit ?? 60),
              service_warn: Number(data.preferences.service_warn ?? 30),
              service_crit: Number(data.preferences.service_crit ?? 60),
            }
            const hasPreview = (typeof window !== 'undefined') && (window as any).__prefPreviewRef && (window as any).__prefPreviewRef.current
            if (!hasPreview) {
              setPreferences(fetchedPreferences)
            }
            setOriginalPreferences({
              theme: fetchedPreferences.theme,
              locale: fetchedPreferences.locale,
              timezone: fetchedPreferences.timezone,
              currency: fetchedPreferences.currency
            })
            // Apply theme on load
            if (!previewedRef.current) { if (!(typeof window !== "undefined" && (window as any).__prefPreviewRef && (window as any).__prefPreviewRef.current)) { setTheme(fetchedPreferences.theme) } }
          }
        }
      } catch (error) {
        console.error("Failed to fetch preferences:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchPreferences()
  }, [setTheme])

  // Track unsaved changes
  useEffect(() => {
    if (loading) return
    const hasChanges = 
      preferences.theme !== originalPreferences.theme ||
      preferences.locale !== originalPreferences.locale ||
      preferences.timezone !== originalPreferences.timezone ||
      preferences.currency !== originalPreferences.currency
    setHasUnsavedChanges(hasChanges)
  }, [preferences, originalPreferences, loading])

  const savePreferences = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(preferences)
      })
      
      if (res.ok) {
        // Update original preferences to match saved values
        setOriginalPreferences({
          theme: preferences.theme,
          locale: preferences.locale,
          timezone: preferences.timezone,
          currency: preferences.currency
        })
        setHasUnsavedChanges(false)
        // Refresh settings context so currency and timezone updates everywhere
        setTheme(preferences.theme)
        try { (window as any).localStorage?.setItem('lastThemeUser', (await (await fetch('/api/auth/me', { credentials: 'include' })).json()).user?.id || '') } catch {}
        await refreshSettings()
        toast.success("Preferences updated successfully")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update preferences")
        // Revert preferences if save failed
        setTheme(originalPreferences.theme)
        setPreferences(prev => ({
          ...prev,
          theme: originalPreferences.theme,
          locale: originalPreferences.locale,
          timezone: originalPreferences.timezone,
          currency: originalPreferences.currency
        }))
      }
    } catch (error) {
      toast.error("Failed to update preferences")
      // Revert preferences if save failed
      setTheme(originalPreferences.theme)
      setPreferences(prev => ({
        ...prev,
        theme: originalPreferences.theme,
        locale: originalPreferences.locale,
        timezone: originalPreferences.timezone,
        currency: originalPreferences.currency
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-600" />
          Display Preferences
        </CardTitle>
        <CardDescription>
          Customize how the system looks and behaves for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select 
              name="theme"
              value={preferences.theme} 
              onValueChange={(value) => {
                setPreferences(prev => ({ ...prev, theme: value }))
                // Apply theme immediately for preview and mark as user-initiated
                ;(typeof window !== 'undefined' && (window as any).__prefPreviewRef) && ((window as any).__prefPreviewRef.current = true)
                setTheme(value)
              }}
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select 
              name="language"
              value={preferences.locale} 
              onValueChange={(value) => setPreferences(prev => ({ ...prev, locale: value }))}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-GB">English (UK)</SelectItem>
                <SelectItem value="en-US">English (American)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select 
              name="timezone"
              value={preferences.timezone} 
              onValueChange={(value) => setPreferences(prev => ({ ...prev, timezone: value }))}
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Africa/Kampala">Africa/Kampala (EAT)</SelectItem>
                <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select 
              name="currency"
              value={preferences.currency} 
              onValueChange={(value) => setPreferences(prev => ({ ...prev, currency: value }))}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UGX">UGX (Ugandan Shilling)</SelectItem>
                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Queue SLA Thresholds (minutes) */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-semibold mb-2">Queue SLA Thresholds (minutes)</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label htmlFor="queue_wait_warn">Waiting Warn</Label>
              <Input
                id="queue_wait_warn"
                type="number"
                min={0}
                max={600}
                value={preferences.queue_wait_warn}
                onChange={(e) => setPreferences(prev => ({ ...prev, queue_wait_warn: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="queue_wait_crit">Waiting Critical</Label>
              <Input
                id="queue_wait_crit"
                type="number"
                min={0}
                max={600}
                value={preferences.queue_wait_crit}
                onChange={(e) => setPreferences(prev => ({ ...prev, queue_wait_crit: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service_warn">In Service Warn</Label>
              <Input
                id="service_warn"
                type="number"
                min={0}
                max={600}
                value={preferences.service_warn}
                onChange={(e) => setPreferences(prev => ({ ...prev, service_warn: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service_crit">In Service Critical</Label>
              <Input
                id="service_crit"
                type="number"
                min={0}
                max={600}
                value={preferences.service_crit}
                onChange={(e) => setPreferences(prev => ({ ...prev, service_crit: Number(e.target.value || 0) }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These thresholds control queue coloring and averages in the Queue board.
          </p>
        </div>

        {hasUnsavedChanges && (
          <p className="text-sm text-amber-600 text-center">
            You have unsaved changes. Changes are in preview mode.
          </p>
        )}
        
        <Button onClick={savePreferences} disabled={saving || loading} className="w-full">
          {loading ? "Loading..." : saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  )
}






