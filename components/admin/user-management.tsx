"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAdmin, type SystemUser, type UserRole } from "@/lib/admin-context"
import { useFormatDate } from "@/lib/date-utils"
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Loader2, Filter, X, ChevronDown, ChevronUp, SortAsc, SortDesc, Users, UserCheck, UserX, Calendar, BarChart3, Activity, UserCircle2 } from "lucide-react"
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
import { toast } from "sonner"

interface UserSummary {
  total: number
  active: number
  inactive: number
  byRole: Record<UserRole, number>
}

export function UserManagement() {
  const { users, addUser, updateUser, deleteUser } = useAdmin()
  const { formatDate } = useFormatDate()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Search and filter state
  const [filters, setFilters] = useState({
    role: "",
    status: "",
    createdAfter: "",
    createdBefore: ""
  })
  const [sortBy, setSortBy] = useState<"name" | "email" | "role" | "status" | "createdAt" | "lastLogin">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // User summary statistics
  const userSummary = useMemo((): UserSummary => {
    const summary: UserSummary = {
      total: users.length,
      active: users.filter(u => u.status === "active").length,
      inactive: users.filter(u => u.status === "inactive").length,
      byRole: {
        "Hospital Admin": 0,
        "Doctor": 0,
        "Midwife": 0,
        "Dentist": 0,
        "Nurse": 0,
        "Receptionist": 0,
        "Lab Tech": 0,
        "Radiologist": 0,
        "Pharmacist": 0,
        "Cashier": 0
      }
    }
    
    users.forEach(user => {
      summary.byRole[user.role]++
    })
    
    return summary
  }, [users])

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter(user => {
      // Search term filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.role.toLowerCase().includes(searchLower)

      // Role filter
      const matchesRole = !filters.role || user.role === filters.role

      // Status filter
      const matchesStatus = !filters.status || user.status === filters.status

      // Date filters
      const userCreatedAt = new Date(user.createdAt)
      const matchesCreatedAfter = !filters.createdAfter || userCreatedAt >= new Date(filters.createdAfter)
      const matchesCreatedBefore = !filters.createdBefore || userCreatedAt <= new Date(filters.createdBefore)

      return matchesSearch && matchesRole && matchesStatus && matchesCreatedAfter && matchesCreatedBefore
    })

    // Sort users
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case "name":
          aValue = a.name
          bValue = b.name
          break
        case "email":
          aValue = a.email
          bValue = b.email
          break
        case "role":
          aValue = a.role
          bValue = b.role
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case "lastLogin":
          aValue = a.lastLogin ? new Date(a.lastLogin).getTime() : 0
          bValue = b.lastLogin ? new Date(b.lastLogin).getTime() : 0
          break
        default:
          aValue = a.name
          bValue = b.name
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      } else {
        return sortOrder === "asc" ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
      }
    })

    return filtered
  }, [users, searchTerm, filters, sortBy, sortOrder])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage)
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filters, sortBy, sortOrder])

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setFilters({
      role: "",
      status: "",
      createdAfter: "",
      createdBefore: ""
    })
    setSortBy("name")
    setSortOrder("asc")
  }

  // Get unique roles for filter options
  const uniqueRoles = useMemo(() => [...new Set(users.map(user => user.role))], [users])

  const activeFilters = useMemo(() => {
    const pills: Array<{ label: string; value: string; onClear: () => void }> = []
    if (filters.role) pills.push({ label: 'Role', value: filters.role, onClear: () => setFilters({ ...filters, role: '' }) })
    if (filters.status) pills.push({ label: 'Status', value: filters.status, onClear: () => setFilters({ ...filters, status: '' }) })
    if (filters.createdAfter) pills.push({ label: 'Created after', value: filters.createdAfter, onClear: () => setFilters({ ...filters, createdAfter: '' }) })
    if (filters.createdBefore) pills.push({ label: 'Created before', value: filters.createdBefore, onClear: () => setFilters({ ...filters, createdBefore: '' }) })
    return pills
  }, [filters])

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      await addUser({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        role: formData.get("role") as UserRole,
        status: "active",
      } as any)
      toast.success("User created successfully")
      // Close dialog - form will reset automatically due to key prop
      setIsAddDialogOpen(false)
      setShowAddPassword(false)
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
      setLoading(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingUser) return
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      // Only update role and status - name, email, and password are not editable here
      await updateUser(editingUser.id, {
        role: formData.get("role") as UserRole,
        status: formData.get("status") as "active" | "inactive",
      } as any)
      toast.success("User updated successfully")
      setEditingUser(null)
      setShowEditPassword(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to update user")
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      "Hospital Admin": "bg-purple-100 text-purple-800",
      "Doctor": "bg-blue-100 text-blue-800",
      "Midwife": "bg-rose-100 text-rose-800",
      "Dentist": "bg-sky-100 text-sky-800",
      "Nurse": "bg-green-100 text-green-800",
      "Receptionist": "bg-yellow-100 text-yellow-800",
      "Lab Tech": "bg-orange-100 text-orange-800",
      "Radiologist": "bg-pink-100 text-pink-800",
      "Pharmacist": "bg-teal-100 text-teal-800",
      "Cashier": "bg-indigo-100 text-indigo-800",
    }
    return colors[role] || "bg-gray-100 text-gray-800"
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
            <div className="text-3xl font-semibold text-slate-900">{userSummary.total}</div>
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
            <div className="text-3xl font-semibold text-slate-900">{Object.keys(userSummary.byRole).length}</div>
            <p className="text-xs text-muted-foreground">Different roles</p>
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
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
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
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((u) => (
                    <div key={u.id} className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-700">
                        {u.name.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px]">
                          <span className="font-medium">{u.name}</span> was added as <span className="font-medium">{u.role}</span>.
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Created {formatDate(u.createdAt)}{u.lastLogin ? ` · Last login ${formatDate(u.lastLogin)}` : ''}
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
                    className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2 py-0.5 text-slate-700"
                    onClick={f.onClear}
                  >
                    <span className="font-medium">{f.label}:</span>
                    <span>{f.value}</span>
                    <X className="h-3 w-3 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="text-sm text-muted-foreground">
            Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} users
            {filteredAndSortedUsers.length !== users.length && (
              <span> (filtered from {users.length} total)</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add User Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Dialog 
          open={isAddDialogOpen} 
          onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) {
              setShowAddPassword(false)
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
                <Select name="role" required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                    <SelectItem value="Doctor">Clinician</SelectItem>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
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

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>System Users ({filteredAndSortedUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No users in the system</h3>
              <p className="text-muted-foreground mb-4">
                Add users to start managing your hospital's staff
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First User
              </Button>
            </div>
          ) : filteredAndSortedUsers.length === 0 ? (
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
          ) : (
            <>
              <div className="space-y-4">
                {paginatedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>{user.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Created: {formatDate(new Date(user.createdAt))}
                      {user.lastLogin && ` • Last login: ${formatDate(new Date(user.lastLogin))}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    <DialogContent>
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
                          <Select name="role" defaultValue={user.role} required>
                          <SelectTrigger id="edit-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Receptionist">Receptionist</SelectItem>
                            <SelectItem value="Doctor">Doctor</SelectItem>
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
                          <Select name="status" defaultValue={user.status} required>
                            <SelectTrigger id="edit-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? (
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
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1
                        const isActive = pageNum === currentPage
                        return (
                          <Button
                            key={pageNum}
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                      {totalPages > 5 && (
                        <>
                          <span className="text-muted-foreground">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 p-0"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
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

