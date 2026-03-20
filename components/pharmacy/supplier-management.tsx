"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Mail, Phone, MapPin, Pencil, Trash2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Supplier } from "@/lib/pharmacy-context"

const EMPTY_FORM = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  nda_license_number: "",
  payment_terms: "",
}

export function SupplierManagement() {
  const { suppliers, refreshSuppliers } = usePharmacy()
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === "Hospital Admin"

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    refreshSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM })
    setFormError(null)
  }

  const openAdd = () => {
    resetForm()
    setShowAddDialog(true)
  }

  const openEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      nda_license_number: supplier.nda_license_number ?? "",
      payment_terms: supplier.payment_terms ?? "",
    })
    setFormError(null)
    setEditSupplier(supplier)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError("Supplier name is required.")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch("/api/pharmacy/suppliers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          contact_person: formData.contact_person || undefined,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          address: formData.address || undefined,
          nda_license_number: formData.nda_license_number || undefined,
          payment_terms: formData.payment_terms || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || "Failed to create supplier. Please try again.")
        return
      }
      await refreshSuppliers()
      toast({ title: "Supplier added", description: `"${formData.name}" has been added successfully.` })
      resetForm()
      setShowAddDialog(false)
    } catch {
      setFormError("Network error. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSupplier) return
    if (!formData.name.trim()) {
      setFormError("Supplier name is required.")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/pharmacy/suppliers/${editSupplier.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          contact_person: formData.contact_person || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          nda_license_number: formData.nda_license_number || null,
          payment_terms: formData.payment_terms || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || "Failed to update supplier. Please try again.")
        return
      }
      await refreshSuppliers()
      toast({ title: "Supplier updated", description: `"${formData.name}" has been updated.` })
      setEditSupplier(null)
      resetForm()
    } catch {
      setFormError("Network error. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/pharmacy/suppliers/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Failed to delete supplier.", variant: "destructive" })
        return
      }
      await refreshSuppliers()
      toast({ title: "Supplier removed", description: `"${deleteTarget.name}" has been deactivated.` })
    } catch {
      toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" })
    } finally {
      setSubmitting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <Card className="rounded-xl border-border/80 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Supplier Management</CardTitle>
              <CardDescription>Manage medication suppliers</CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {suppliers.length === 0 && (
              <p className="text-sm text-muted-foreground">No suppliers found.</p>
            )}
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{supplier.name}</h3>
                    {supplier.contact_person && (
                      <p className="text-sm text-muted-foreground">Contact: {supplier.contact_person}</p>
                    )}
                    {supplier.nda_license_number && (
                      <p className="text-xs text-muted-foreground mt-1">NDA: {supplier.nda_license_number}</p>
                    )}
                    {supplier.payment_terms && (
                      <p className="text-xs text-muted-foreground">Terms: {supplier.payment_terms}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-foreground truncate">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-foreground">{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-foreground">{supplier.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEdit(supplier)} aria-label="Edit supplier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(supplier)}
                        aria-label="Delete supplier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { resetForm(); setShowAddDialog(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>Add a new medication supplier to the system.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <SupplierFormFields formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowAddDialog(false) }} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={!!editSupplier} onOpenChange={(open) => { if (!open) { setEditSupplier(null); resetForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <SupplierFormFields formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditSupplier(null); resetForm() }} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.name}</strong>? This supplier will no longer appear in the system but existing purchase orders will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? "Removing..." : "Remove Supplier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface SupplierFormFieldsProps {
  formData: typeof EMPTY_FORM
  setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
}

function SupplierFormFields({ formData, setFormData }: SupplierFormFieldsProps) {
  const field = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <>
      <div>
        <Label htmlFor="sup-name">
          Supplier Name <span className="text-destructive">*</span>
        </Label>
        <Input id="sup-name" value={formData.name} onChange={field("name")} required />
      </div>
      <div>
        <Label htmlFor="sup-contact">Contact Person</Label>
        <Input id="sup-contact" value={formData.contact_person} onChange={field("contact_person")} />
      </div>
      <div>
        <Label htmlFor="sup-phone">Phone</Label>
        <Input id="sup-phone" value={formData.phone} onChange={field("phone")} />
      </div>
      <div>
        <Label htmlFor="sup-email">Email</Label>
        <Input id="sup-email" type="email" value={formData.email} onChange={field("email")} />
      </div>
      <div>
        <Label htmlFor="sup-address">Address</Label>
        <Input id="sup-address" value={formData.address} onChange={field("address")} />
      </div>
      <div>
        <Label htmlFor="sup-nda">NDA License Number</Label>
        <Input id="sup-nda" value={formData.nda_license_number} onChange={field("nda_license_number")} />
      </div>
      <div>
        <Label htmlFor="sup-terms">Payment Terms</Label>
        <Input id="sup-terms" value={formData.payment_terms} onChange={field("payment_terms")} placeholder="e.g. Net 30" />
      </div>
    </>
  )
}
