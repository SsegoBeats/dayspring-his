"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageViewerProps {
  images: Array<{ url: string; name?: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
  initialIndex?: number
}

export function ImageViewer({ images, open, onOpenChange, initialIndex = 0 }: ImageViewerProps) {
  if (images.length === 0) return null

  const viewerKey = `${initialIndex}-${images[initialIndex]?.url || images.length}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ViewerContent key={viewerKey} images={images} initialIndex={initialIndex} />
    </Dialog>
  )
}

function ViewerContent({
  images,
  initialIndex,
}: {
  images: Array<{ url: string; name?: string }>
  initialIndex: number
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const currentImage = images[currentIndex]
  const hasMultiple = images.length > 1

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
    setZoom(1)
    setRotation(0)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
    setZoom(1)
    setRotation(0)
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
  }

  return (
    <DialogContent className="max-w-7xl h-[90vh] p-0 flex flex-col">
      <DialogHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold">
            {currentImage.name || `Image ${currentIndex + 1} of ${images.length}`}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {hasMultiple && (
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="flex-1 relative overflow-hidden bg-black/90 flex items-center justify-center">
        {/* Image container */}
        <div className="relative w-full h-full flex items-center justify-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}>
          <Image
            src={currentImage.url}
            alt={currentImage.name || `Image ${currentIndex + 1}`}
            fill
            className="object-contain transition-transform duration-200"
            unoptimized
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = "none"
            }}
          />
        </div>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Controls overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-lg p-2">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-white hover:bg-white/20">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white text-sm min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-white hover:bg-white/20">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-white/30 mx-1" />
          <Button variant="ghost" size="icon" onClick={handleRotate} className="text-white hover:bg-white/20">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} className="text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && images.length <= 10 && (
        <div className="px-6 py-4 border-t bg-muted/30 overflow-x-auto">
          <div className="flex gap-2 justify-center">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx)
                  setZoom(1)
                  setRotation(0)
                }}
                className={cn(
                  "relative w-20 h-20 rounded border-2 overflow-hidden flex-shrink-0 transition-all",
                  idx === currentIndex ? "border-primary ring-2 ring-primary/20" : "border-border opacity-60 hover:opacity-100"
                )}
              >
                <Image src={img.url} alt={`Thumbnail ${idx + 1}`} width={80} height={80} className="w-full h-full object-cover" unoptimized />
              </button>
            ))}
          </div>
        </div>
      )}
    </DialogContent>
  )
}
