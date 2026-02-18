"use client"

import { useState, useEffect } from "react"
import { useMedical } from "@/lib/medical-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, XCircle, Image as ImageIcon, History, FileText, Edit2 } from "lucide-react"
import { toast } from "sonner"
import { ImageViewer } from "./image-viewer"

interface RadiologyTestDetailsProps {
  testId: string
  onBack: () => void
}

export function RadiologyTestDetails({ testId, onBack, onSelectTest }: RadiologyTestDetailsProps) {
  const { labResults, updateLabResult, refreshMedicalData } = useMedical()
  const { getPatient } = usePatients()
  const test = labResults.find((lr) => lr.id === testId)
  const patient = test ? getPatient(test.patientId) : null

  const [results, setResults] = useState(test?.results || "")
  const [notes, setNotes] = useState(test?.notes || "")
  const [images, setImages] = useState<Array<{ url: string; name?: string }>>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerIndex, setImageViewerIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [previousStudies, setPreviousStudies] = useState<LabResult[]>([])
  const [showPreviousStudies, setShowPreviousStudies] = useState(false)

  useEffect(() => {
    if (!test) return
    setResults(test.results || "")
    setNotes(test.notes || "")
  }, [test?.id])

  useEffect(() => {
    if (!test?.patientId) return
    setImagesLoading(true)
    fetch(`/api/documents?patientId=${encodeURIComponent(test.patientId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => {
        const docs = Array.isArray(data.documents) ? data.documents : []
        const imageDocs = docs
          .filter((d: any) => d.file_url && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(d.file_url))
          .map((d: any) => ({
            url: d.file_url.startsWith("http") ? d.file_url : `${window.location.origin}${d.file_url}`,
            name: d.type || `Image ${d.id}`,
          }))
        setImages(imageDocs)
      })
      .catch(() => setImages([]))
      .finally(() => setImagesLoading(false))
  }, [test?.patientId])

  if (!test) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Scan not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleSubmitResults = async () => {
    try {
      const res = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed", results, notes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || "Failed to submit report")
        return
      }
      updateLabResult(test.id, {
        status: "completed",
        completedDate: new Date().toISOString().split("T")[0],
        results,
        notes,
      })
      await refreshMedicalData()
      toast.success("Scan results submitted successfully!")
      onBack()
    } catch {
      toast.error("Failed to submit report")
    }
  }

  const handleCancelTest = async () => {
    if (!confirm("Are you sure you want to cancel this scan?")) return

    try {
      const res = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || "Failed to cancel scan")
        return
      }
      updateLabResult(test.id, {
        status: "cancelled",
      })
      await refreshMedicalData()
      toast.success("Scan cancelled")
      onBack()
    } catch {
      toast.error("Failed to cancel scan")
    }
  }

  const handleUpdateReport = async () => {
    if (!results.trim()) {
      toast.error("Findings are required")
      return
    }
    try {
      const res = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, notes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || "Failed to update report")
        return
      }
      updateLabResult(test.id, {
        results,
        notes,
      })
      await refreshMedicalData()
      setIsEditing(false)
      toast.success("Report updated successfully")
    } catch {
      toast.error("Failed to update report")
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{test.testType}</CardTitle>
              <CardDescription>Scan ID: {test.id}</CardDescription>
            </div>
            <Badge
              variant={
                test.status === "completed" ? "default" : test.status === "pending" ? "secondary" : "destructive"
              }
            >
              {test.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Patient Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="text-foreground">{test.patientName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Patient ID:</span>{" "}
                  <span className="text-foreground">{test.patientId}</span>
                </div>
                {patient && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Age:</span>{" "}
                      <span className="text-foreground">
                        {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gender:</span>{" "}
                      <span className="text-foreground">{patient.gender}</span>
                    </div>
                    {patient.bloodGroup && (
                      <div>
                        <span className="text-muted-foreground">Blood Group:</span>{" "}
                        <span className="text-foreground">{patient.bloodGroup}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Scan Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Scan Type:</span>{" "}
                  <span className="text-foreground">{test.testType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ordered By:</span>{" "}
                  <span className="text-foreground">{test.orderedBy}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ordered Date:</span>{" "}
                  <span className="text-foreground">{test.orderedDate}</span>
                </div>
                {test.completedDate && (
                  <div>
                    <span className="text-muted-foreground">Completed Date:</span>{" "}
                    <span className="text-foreground">{test.completedDate}</span>
                  </div>
                )}
                {test.assignedToName && (
                  <div>
                    <span className="text-muted-foreground">Assigned To:</span>{" "}
                    <span className="text-foreground">{test.assignedToName}</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreviousStudies(!showPreviousStudies)}
                className="w-full"
              >
                <History className="h-4 w-4 mr-2" />
                {showPreviousStudies ? "Hide" : "Show"} Previous Studies
              </Button>
            </div>
          </div>

          {showPreviousStudies && previousStudies.length > 0 && (
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Previous Studies ({previousStudies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {previousStudies.map((prev) => (
                    <div
                      key={prev.id}
                      className="border border-border rounded-lg p-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (onSelectTest) {
                          onSelectTest(prev.id)
                        } else {
                          onBack()
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{prev.testType}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {prev.completedDate
                              ? `Completed: ${new Date(prev.completedDate).toLocaleDateString()}`
                              : `Ordered: ${new Date(prev.orderedDate).toLocaleDateString()}`}
                          </div>
                          {prev.results && (
                            <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {prev.results.substring(0, 150)}
                              {prev.results.length > 150 ? "..." : ""}
                            </div>
                          )}
                        </div>
                        <Badge variant={prev.status === "completed" ? "default" : "secondary"} className="ml-2">
                          {prev.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {test.status === "pending" ? (
            <div className="space-y-4">
              {images.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Study Images ({images.length})
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setImageViewerIndex(idx)
                          setImageViewerOpen(true)
                        }}
                        className="relative aspect-square rounded-lg border border-border overflow-hidden hover:border-primary transition-colors group"
                      >
                        <img
                          src={img.url}
                          alt={img.name || `Image ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="results">Radiological Findings *</Label>
                  {reportTemplates[test.testType] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTemplates(!showTemplates)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Templates
                    </Button>
                  )}
                </div>
                {showTemplates && reportTemplates[test.testType] && (
                  <div className="border border-border rounded-lg p-3 bg-muted/30 mb-2">
                    <div className="text-xs font-medium mb-2">Common Findings:</div>
                    <div className="flex flex-wrap gap-2">
                      {reportTemplates[test.testType].map((template, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setResults((prev) => (prev ? `${prev}\n\n${template}` : template))
                            setShowTemplates(false)
                          }}
                        >
                          {template.substring(0, 40)}...
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <Textarea
                  id="results"
                  placeholder="Enter detailed radiological findings and interpretation..."
                  value={results}
                  onChange={(e) => setResults(e.target.value)}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional observations, recommendations, or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmitResults} disabled={!results} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Submit Report
                </Button>
                <Button variant="destructive" onClick={handleCancelTest}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Scan
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {images.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Study Images ({images.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setImageViewerIndex(idx)
                          setImageViewerOpen(true)
                        }}
                        className="relative aspect-square rounded-lg border border-border overflow-hidden hover:border-primary transition-colors group"
                      >
                        <img
                          src={img.url}
                          alt={img.name || `Image ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isEditing ? (
                <>
                  {test.results && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Radiological Findings</h3>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Report
                        </Button>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/50 p-4">
                        <p className="text-sm text-foreground">{test.results}</p>
                      </div>
                    </div>
                  )}

                  {test.notes && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground">Notes</h3>
                      <div className="rounded-lg border border-border bg-muted/50 p-4">
                        <p className="text-sm text-foreground">{test.notes}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-results">Radiological Findings *</Label>
                    <Textarea
                      id="edit-results"
                      placeholder="Enter detailed radiological findings and interpretation..."
                      value={results}
                      onChange={(e) => setResults(e.target.value)}
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Additional Notes</Label>
                    <Textarea
                      id="edit-notes"
                      placeholder="Any additional observations, recommendations, or notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleUpdateReport} disabled={!results} className="flex-1">
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false)
                      setResults(test?.results || "")
                      setNotes(test?.notes || "")
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {images.length > 0 && (
            <ImageViewer
              images={images}
              open={imageViewerOpen}
              onOpenChange={setImageViewerOpen}
              initialIndex={imageViewerIndex}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
