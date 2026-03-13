"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAdmin, type SystemUser, type UserRole } from "@/lib/admin-context"
import { useFormatDate } from "@/lib/date-utils"
import { buildSearchParamsString } from "@/lib/search-params"
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Loader2, Filter, X, ChevronDown, ChevronUp, SortAsc, SortDesc, Users, UserCheck, UserX, BarChart3, Activity, CheckSquare, Square, Download, FileSpreadsheet, FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface UserSummary {
  total: number
  active: number
  inactive: number
  byRole: Record<UserRole, number>
}

const API_SORT_MAP: Record<string, string> = {
    name: "name",
    email: "email",
    role: "role",
    status: "is_active",
    createdAt: "created_at",
    lastLogin: "last_login",
  }

const ROLES_FOR_FILTER: UserRole[] = [
    "Hospital Admin", "Clinician", "Midwife", "Dentist", "Nurse",
    "Receptionist", "Lab Tech", "Radiologist", "Pharmacist", "Cashier",
  ]

const USER_SORT_FIELDS = ["name", "email", "role", "status", "createdAt", "lastLogin"] as const
type UserSortField = (typeof USER_SORT_FIELDS)[number]

export function UserManagement() {
  const { users, total, summary, loading, fetchUsers, addUser, updateUser, deleteUser } = useAdmin()
  const { formatDate } = useFormatDate()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("userSearch") ?? "")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingFormat, setExportingFormat] = useState<"csv" | "xlsx" | "pdf" | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false)
  const [bulkRoleValue, setBulkRoleValue] = useState<string>("")
  const [addRole, setAddRole] = useState<string>("Receptionist")
  const [editRole, setEditRole] = useState<string>("")
  const [editStatus, setEditStatus] = useState<string>("active")

  const [filters, setFilters] = useState(() => ({
    role: searchParams.get("userRole") ?? "",
    status: searchParams.get("userStatus") ?? "",
    createdAfter: searchParams.get("userCreatedAfter") ?? "",
    createdBefore: searchParams.get("userCreatedBefore") ?? "",
  }))
  const [sortBy, setSortBy] = useState<UserSortField>(() => {
    const value = searchParams.get("userSortBy")
    return USER_SORT_FIELDS.includes(value as UserSortField) ? (value as UserSortField) : "name"
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => (searchParams.get("userSortOrder") === "desc" ? "desc" : "asc"))
  const [showFilters, setShowFilters] = useState(() =>
    Boolean(
      searchParams.get("userRole") ||
      searchParams.get("userStatus") ||
      searchParams.get("userCreatedAfter") ||
      searchParams.get("userCreatedBefore"),
    ),
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  const userSummary: UserSummary = useMemo(() => {
    if (summary) {
      const byRole: Record<UserRole, number> = {
        "Hospital Admin": 0, "Clinician": 0, "Midwife": 0, "Dentist": 0, "Nurse": 0,
        "Receptionist": 0, "Lab Tech": 0, "Radiologist": 0, "Pharmacist": 0, "Cashier": 0,
      }
      Object.assign(byRole, summary.byRole || {})
      return { total: summary.total, active: summary.active, inactive: summary.inactive, byRole }
    }
    return { total: 0, active: 0, inactive: 0, byRole: {} as Record<UserRole, number> }
  }, [summary])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filters, sortBy, sortOrder])

  useEffect(() => {
    const nextSearchTerm = searchParams.get("userSearch") ?? ""
    const nextFilters = {
      role: searchParams.get("userRole") ?? "",
      status: searchParams.get("userStatus") ?? "",
      createdAfter: searchParams.get("userCreatedAfter") ?? "",
      createdBefore: searchParams.get("userCreatedBefore") ?? "",
    }
    const nextSortByValue = searchParams.get("userSortBy")
    const nextSortBy = USER_SORT_FIELDS.includes(nextSortByValue as UserSortField)
      ? (nextSortByValue as UserSortField)
      : "name"
    const nextSortOrder = searchParams.get("userSortOrder") === "desc" ? "desc" : "asc"

    setSearchTerm((prev) => (prev === nextSearchTerm ? prev : nextSearchTerm))
    setFilters((prev) =>
      prev.role === nextFilters.role &&
      prev.status === nextFilters.status &&
      prev.createdAfter === nextFilters.createdAfter &&
      prev.createdBefore === nextFilters.createdBefore
        ? prev
        : nextFilters,
    )
    setSortBy((prev) => (prev === nextSortBy ? prev : nextSortBy))
    setSortOrder((prev) => (prev === nextSortOrder ? prev : nextSortOrder))
  }, [searchParams])

  useEffect(() => {
    const query = buildSearchParamsString(searchParams, {
      userSearch: searchTerm || null,
      userRole: filters.role || null,
      userStatus: filters.status || null,
      userCreatedAfter: filters.createdAfter || null,
      userCreatedBefore: filters.createdBefore || null,
      userSortBy: sortBy === "name" ? null : sortBy,
      userSortOrder: sortOrder === "asc" ? null : sortOrder,
    })
    const current = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    const target = query ? `${pathname}?${query}` : pathname
    if (target !== current) router.replace(target, { scroll: false })
  }, [filters.createdAfter, filters.createdBefore, filters.role, filters.status, pathname, router, searchParams, searchTerm, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers({
      page: currentPage,
      pageSize: itemsPerPage,
      search: searchTerm || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      createdAfter: filters.createdAfter || undefined,
      createdBefore: filters.createdBefore || undefined,
      sortBy: API_SORT_MAP[sortBy] || "created_at",
      sortOrder,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refetch when pagination/filters change
  }, [currentPage, itemsPerPage, searchTerm, filters.role, filters.status, filters.createdAfter, filters.createdBefore, sortBy, sortOrder])

  const totalPages = Math.ceil(total / itemsPerPage) || 1
  const paginatedUsers = users

  const replaceUserSearchParams = (updates: Record<string, string | null>) => {
    const query = buildSearchParamsString(searchParams, updates)
    const target = query ? `${pathname}?${query}` : pathname
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", target)
    }
    router.replace(target, { scroll: false })
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilters({ role: "", status: "", createdAfter: "", createdBefore: "" })
    setSortBy("name")
    setSortOrder("asc")
    setCurrentPage(1)
    replaceUserSearchParams({
      userSearch: null,
      userRole: null,
      userStatus: null,
      userCreatedAfter: null,
      userCreatedBefore: null,
      userSortBy: null,
      userSortOrder: null,
    })
  }

  const uniqueRoles = ROLES_FOR_FILTER

  const activeFilters = useMemo(() => {
    const pills: Array<{ label: string; value: string; onClear: () => void }> = []
    if (filters.role) pills.push({ label: 'Role', value: filters.role, onClear: () => setFilters({ ...filters, role: '' }) })
    if (filters.status) pills.push({ label: 'Status', value: filters.status, onClear: () => setFilters({ ...filters, status: '' }) })
    if (filters.createdAfter) pills.push({ label: 'Created after', value: filters.createdAfter, onClear: () => setFilters({ ...filters, createdAfter: '' }) })
    if (filters.createdBefore) pills.push({ label: 'Created before', value: filters.createdBefore, onClear: () => setFilters({ ...filters, createdBefore: '' }) })
    return pills
  }, [filters])

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedUsers.map((u) => u.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const runBulkAction = async (action: "activate" | "deactivate" | "changeRole", role?: string) => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          userIds: Array.from(selectedIds),
          ...(action === "changeRole" && role ? { role } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk action failed")
      toast.success(`${data.updated ?? selectedIds.size} user(s) updated`)
      setSelectedIds(new Set())
      setBulkRoleDialogOpen(false)
      setBulkRoleValue("")
      await refetch()
    } catch (e: any) {
      toast.error(e.message || "Bulk action failed")
    } finally {
      setBulkLoading(false)
    }
  }

  const refetch = () => fetchUsers({
    page: currentPage,
    pageSize: itemsPerPage,
    search: searchTerm || undefined,
    role: filters.role || undefined,
    status: filters.status || undefined,
    createdAfter: filters.createdAfter || undefined,
    createdBefore: filters.createdBefore || undefined,
    sortBy: API_SORT_MAP[sortBy] || "created_at",
    sortOrder,
  })

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const name = (formData.get("name") as string)?.trim()
      const email = (formData.get("email") as string)?.trim()
      const password = formData.get("password") as string
      if (!name || !email || !password) {
        toast.error("Name, email, and password are required")
        setFormLoading(false)
        return
      }
      if (!addRole) {
        toast.error("Please select a role")
        setFormLoading(false)
        return
      }
      await addUser({
        name,
        email,
        password,
        role: addRole as UserRole,
        status: "active",
      } as any)
      toast.success("User created successfully")
      setIsAddDialogOpen(false)
      setShowAddPassword(false)
      await refetch()
    } catch (error: any) {
      // Display detailed password validation errors if available
      if (error.message && error.message.includes("Weak password")) {
        toast.error("Password does not meet security requirements", {
          description: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
        })
      } else {
        toast.error(error.message || "Failed to create user")
      }
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingUser) return
    setFormLoading(true)
    try {
      if (!editRole) {
        toast.error("Please select a role")
        setFormLoading(false)
        return
      }
      await updateUser(editingUser.id, {
        role: editRole as UserRole,
        status: editStatus as "active" | "inactive",
      } as any)
      toast.success("User updated successfully")
      setEditingUser(null)
      setShowEditPassword(false)
      await refetch()
    } catch (error: any) {
      toast.error(error.message || "Failed to update user")
    } finally {
      setFormLoading(false)
    }
  }

  const exportUsers = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      setExportingFormat(format)
      const response = await fetch("/api/exports/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataset: "users",
          format,
          filters: {
            search: searchTerm || undefined,
            role: filters.role || undefined,
            status: filters.status || undefined,
            createdAfter: filters.createdAfter ? `${filters.createdAfter}T00:00:00.000Z` : undefined,
            createdBefore: filters.createdBefore ? `${filters.createdBefore}T23:59:59.999Z` : undefined,
            sortBy,
            sortOrder,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to export users")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `system-users-${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success(`User directory exported as ${format.toUpperCase()}`)
    } catch (error: any) {
      toast.error(error?.message || "Failed to export users")
    } finally {
      setExportingFormat(null)
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      "Hospital Admin": "bg-purple-100 text-purple-800",
      "Clinician": "bg-blue-100 text-blue-800",
      "Midwife": "bg-rose-100 text-rose-800",
      "Dentist": "bg-sky-100 text-sky-800",
      "Nurse": "bg-green-100 text-green-800",
      "Receptionist": "bg-yellow-100 text-yellow-800",
      "Lab Tech": "bg-orange-100 text-orange-800",
      "Radiologist": "bg-pink-100 text-pink-800",
      "Pharmacist": "bg-teal-100 text-teal-800",
      "Cashier": "bg-indigo-100 text-indigo-800",
    }
    return colors[role] || "bg-muted text-foreground"
  }

  return (
    <div className="space-y-6">
      {/* User Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-sm transition-shadow border-sky-100 bg-sky-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-600">Total Users</CardTitle>
            <Users className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{userSummary.total}</div>
            <p className="text-xs text-muted-foreground">System users</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-emerald-100 bg-emerald-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-emerald-700">{userSummary.active}</div>
            <p className="text-xs text-muted-foreground">
              {userSummary.total > 0 ? Math.round((userSummary.active / userSummary.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-rose-100 bg-rose-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-rose-700">Inactive Users</CardTitle>
            <UserX className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-rose-700">{userSummary.inactive}</div>
            <p className="text-xs text-muted-foreground">Disabled accounts</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-purple-100 bg-purple-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-purple-700">Roles</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {Object.entries(userSummary.byRole).filter(([, c]) => c > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Roles in use</p>
          </CardContent>
        </Card>
      </div>

      {/* Role Breakdown + Activity */}
      {Object.values(userSummary.byRole).some(count => count > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Role Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Roles</span>
                    <span>Users</span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(userSummary.byRole).map(([role, count]) => (
                      count > 0 && (
                        <div key={role} className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400"
                              style={{ width: `${(count / (userSummary.total || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-xs text-right font-medium">{count}</span>
                          <span className="text-[11px] text-muted-foreground w-28 truncate">{role}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Use this breakdown to spot gaps in staffing (e.g., no Lab Tech or Radiologist accounts configured).</p>
                  <p>Consider keeping at least one active account per clinical role to avoid service bottlenecks.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                Recent User Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {users.length === 0 ? (
                <p className="text-muted-foreground">No user accounts yet. New activity will appear here once staff accounts are created.</p>
              ) : (
                users
                  .slice(0, 5)
                  .map((u) => (
                    <div key={u.id} className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                        {u.name.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px]">
                          <span className="font-medium">{u.name}</span> was added as <span className="font-medium">{u.role}</span>.
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Created {formatDate(u.createdAt)}{u.lastLogin ? ` - Last login ${formatDate(u.lastLogin)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter Users
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
              {(searchTerm || Object.values(filters).some(f => f)) && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="user-search"
              name="q"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="role-filter">Role</Label>
                <Select name="role-filter" value={filters.role || "all"} onValueChange={(value) => setFilters({ ...filters, role: value === "all" ? "" : value })}>
                  <SelectTrigger id="role-filter">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {uniqueRoles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select name="status-filter" value={filters.status || "all"} onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}>
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="created-after">Created After</Label>
                <Input
                  id="created-after"
                  type="date"
                  value={filters.createdAfter}
                  onChange={(e) => setFilters({ ...filters, createdAfter: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="created-before">Created Before</Label>
                <Input
                  id="created-before"
                  type="date"
                  value={filters.createdBefore}
                  onChange={(e) => setFilters({ ...filters, createdBefore: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Sort Controls + Filter Pills */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="sort-by">Sort by:</Label>
              <Select name="sort-by" value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger id="sort-by" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="createdAt">Date Created</SelectItem>
                  <SelectItem value="lastLogin">Last Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] md:ml-auto">
                {activeFilters.map((f) => (
                  <button
                    key={`${f.label}-${f.value}`}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-muted-foreground"
                    onClick={f.onClear}
                  >
                    <span className="font-medium">{f.label}:</span>
                    <span>{f.value}</span>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="text-sm text-muted-foreground">
            Showing {paginatedUsers.length} of {total} users
          </div>
        </CardContent>
      </Card>

      {/* Add User Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-sm text-muted-foreground">Provision staff accounts, enforce role coverage, and export the current directory.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={loading || total === 0 || Boolean(exportingFormat)}>
                <Download className="mr-2 h-4 w-4" />
                {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportUsers("csv")} disabled={Boolean(exportingFormat)}>
                <FileText className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportUsers("xlsx")} disabled={Boolean(exportingFormat)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportUsers("pdf")} disabled={Boolean(exportingFormat)}>
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) {
                setShowAddPassword(false)
              } else {
                setAddRole("Receptionist")
              }
            }}
          >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new system user account</DialogDescription>
            </DialogHeader>
            <form key={isAddDialogOpen ? 'add-user-form' : 'add-user-form-closed'} onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  name="name" 
                  autoComplete="name"
                  placeholder="John Doe" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  autoComplete="email"
                  placeholder="john.doe@dayspring.com" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showAddPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Enter password"
                    required
                    minLength={8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showAddPassword ? "Hide password" : "Show password"}
                  >
                    {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" value={addRole} onValueChange={setAddRole} required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                    <SelectItem value="Clinician">Clinician</SelectItem>
                    <SelectItem value="Midwife">Midwife</SelectItem>
                    <SelectItem value="Dentist">Dentist</SelectItem>
                    <SelectItem value="Nurse">Nurse</SelectItem>
                    <SelectItem value="Lab Tech">Lab Technician</SelectItem>
                    <SelectItem value="Radiologist">Radiologist</SelectItem>
                    <SelectItem value="Pharmacist">Pharmacist</SelectItem>
                    <SelectItem value="Cashier">Cashier</SelectItem>
                    <SelectItem value="Hospital Admin">Hospital Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={formLoading}>
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>System Users ({total})</CardTitle>
            {users.length > 0 && (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                onClick={toggleSelectAll}
              >
                {selectedIds.size === paginatedUsers.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selectedIds.size === paginatedUsers.length ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading users...</span>
            </div>
          ) : users.length === 0 && (searchTerm || Object.values(filters).some(Boolean)) ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No users match your search</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or filters
              </p>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No users in the system</h3>
              <p className="text-muted-foreground mb-4">
                Add users to start managing your hospital&apos;s staff
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First User
              </Button>
            </div>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 mb-4 rounded-lg bg-muted/60 border">
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkLoading}
                    onClick={() => runBulkAction("activate")}
                  >
                    {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />}
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkLoading}
                    onClick={() => runBulkAction("deactivate")}
                  >
                    {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 mr-1" />}
                    Deactivate
                  </Button>
                  <Dialog open={bulkRoleDialogOpen} onOpenChange={setBulkRoleDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={bulkLoading}>
                        Change Role
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Bulk Change Role</DialogTitle>
                        <DialogDescription>Set role for {selectedIds.size} selected user(s)</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>New Role</Label>
                          <Select value={bulkRoleValue} onValueChange={setBulkRoleValue}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueRoles.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setBulkRoleDialogOpen(false)}>Cancel</Button>
                          <Button disabled={!bulkRoleValue} onClick={() => runBulkAction("changeRole", bulkRoleValue)}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </div>
              )}
              <div className="space-y-4">
                {paginatedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleSelect(user.id)}
                      aria-label={selectedIds.has(user.id) ? "Deselect" : "Select"}
                    >
                      {selectedIds.has(user.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>{user.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Created: {formatDate(new Date(user.createdAt))}
                      {user.lastLogin && ` - Last login: ${formatDate(new Date(user.lastLogin))}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => {
                        if (!open) setEditingUser(null)
                        else {
                          setEditRole(user.role)
                          setEditStatus(user.status)
                        }
                      }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => { setEditingUser(user); setEditRole(user.role); setEditStatus(user.status) }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    <DialogContent key={user.id}>
                      <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>Update user information</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUpdateUser} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Full Name</Label>
                          <Input id="edit-name" name="name" value={user.name} readOnly className="bg-muted" />
                          <p className="text-xs text-muted-foreground">Name cannot be changed here. Users must update their own profile.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-email">Email</Label>
                          <Input id="edit-email" name="email" type="email" value={user.email} readOnly className="bg-muted" />
                          <p className="text-xs text-muted-foreground">Email cannot be changed here. Users must verify email changes through settings.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-password">Password</Label>
                          <Input
                            id="edit-password"
                            name="password"
                            value="••••••••"
                            readOnly
                            disabled
                            className="bg-muted"
                          />
                          <p className="text-xs text-muted-foreground">Passwords must be changed by users through their account settings for security.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-role">Role</Label>
                          <Select name="role" value={editRole} onValueChange={setEditRole} required>
                          <SelectTrigger id="edit-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Receptionist">Receptionist</SelectItem>
                            <SelectItem value="Clinician">Clinician</SelectItem>
                            <SelectItem value="Midwife">Midwife</SelectItem>
                            <SelectItem value="Dentist">Dentist</SelectItem>
                            <SelectItem value="Nurse">Nurse</SelectItem>
                            <SelectItem value="Lab Tech">Lab Technician</SelectItem>
                            <SelectItem value="Radiologist">Radiologist</SelectItem>
                            <SelectItem value="Pharmacist">Pharmacist</SelectItem>
                            <SelectItem value="Cashier">Cashier</SelectItem>
                              <SelectItem value="Hospital Admin">Hospital Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-status">Status</Label>
                          <Select name="status" value={editStatus} onValueChange={setEditStatus} required>
                            <SelectTrigger id="edit-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={formLoading}>
                          {formLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update User"
                          )}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingId === user.id}
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
                        setDeletingId(user.id)
                        try {
                          await deleteUser(user.id)
                          toast.success("User deleted successfully")
                          await refetch()
                        } catch (error: any) {
                          toast.error(error.message || "Failed to delete user")
                        } finally {
                          setDeletingId(null)
                        }
                      }
                    }}
                  >
                    {deletingId === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {(() => {
                        const maxVisible = 5
                        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                        let end = Math.min(totalPages, start + maxVisible - 1)
                        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
                        const pages: number[] = []
                        for (let i = start; i <= end; i++) pages.push(i)
                        return (
                          <>
                            {start > 1 && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} className="w-8 h-8 p-0">1</Button>
                                {start > 2 && <span className="text-muted-foreground px-1">...</span>}
                              </>
                            )}
                            {pages.map((pageNum) => (
                              <Button
                                key={pageNum}
                                variant={pageNum === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            ))}
                            {end < totalPages && (
                              <>
                                {end < totalPages - 1 && <span className="text-muted-foreground px-1">...</span>}
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} className="w-8 h-8 p-0">{totalPages}</Button>
                              </>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
