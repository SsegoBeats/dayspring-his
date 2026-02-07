"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePharmacy } from "@/lib/pharmacy-context"

interface AdvancedSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (filters: AdvancedSearchFilters) => void
  currentFilters?: AdvancedSearchFilters
}

export interface AdvancedSearchFilters {
  name?: string
  category?: string
  manufacturer?: string
  minStock?: number
  maxStock?: number
  minPrice?: number
  maxPrice?: number
  expiryBefore?: string
  hasBarcode?: boolean
}

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  onApply,
  currentFilters = {},
}: AdvancedSearchDialogProps) {
  const { medications } = usePharmacy()
  const [filters, setFilters] = useState<AdvancedSearchFilters>(currentFilters)

  // Get unique categories and manufacturers
  const categories = Array.from(new Set(medications.map((m) => m.category).filter(Boolean))).sort()
  const manufacturers = Array.from(new Set(medications.map((m) => m.manufacturer).filter(Boolean))).sort()

  const handleApply = () => {
    onApply(filters)
    onOpenChange(false)
  }

  const handleReset = () => {
    const emptyFilters: AdvancedSearchFilters = {}
    setFilters(emptyFilters)
    onApply(emptyFilters)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advanced Search</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Medication Name</Label>
            <Input
              id="name"
              placeholder="Search by name"
              value={filters.name || ""}
              onChange={(e) => setFilters({ ...filters, name: e.target.value || undefined })}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={filters.category || ""}
              onValueChange={(value) => setFilters({ ...filters, category: value || undefined })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Select
              value={filters.manufacturer || ""}
              onValueChange={(value) => setFilters({ ...filters, manufacturer: value || undefined })}
            >
              <SelectTrigger id="manufacturer">
                <SelectValue placeholder="All manufacturers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All manufacturers</SelectItem>
                {manufacturers.map((man) => (
                  <SelectItem key={man} value={man}>
                    {man}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="minStock">Minimum Stock</Label>
            <Input
              id="minStock"
              type="number"
              min="0"
              placeholder="Min quantity"
              value={filters.minStock?.toString() || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  minStock: e.target.value ? Number.parseInt(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="maxStock">Maximum Stock</Label>
            <Input
              id="maxStock"
              type="number"
              min="0"
              placeholder="Max quantity"
              value={filters.maxStock?.toString() || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  maxStock: e.target.value ? Number.parseInt(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="minPrice">Minimum Price</Label>
            <Input
              id="minPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="Min price"
              value={filters.minPrice?.toString() || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  minPrice: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="maxPrice">Maximum Price</Label>
            <Input
              id="maxPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="Max price"
              value={filters.maxPrice?.toString() || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  maxPrice: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="expiryBefore">Expires Before</Label>
            <Input
              id="expiryBefore"
              type="date"
              value={filters.expiryBefore || ""}
              onChange={(e) => setFilters({ ...filters, expiryBefore: e.target.value || undefined })}
            />
          </div>

          <div>
            <Label htmlFor="hasBarcode">Barcode</Label>
            <Select
              value={filters.hasBarcode === undefined ? "" : filters.hasBarcode ? "yes" : "no"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  hasBarcode: value === "" ? undefined : value === "yes",
                })
              }
            >
              <SelectTrigger id="hasBarcode">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="yes">Has barcode</SelectItem>
                <SelectItem value="no">No barcode</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

