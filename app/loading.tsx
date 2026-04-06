/**
 * System-level loading screen shown by Next.js Suspense boundaries.
 * Uses the pulse-rings animation defined in globals.css.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Pulse rings */}
      <div className="ds-loader mb-8">
        <div className="ds-loader__ring" />
        <div className="ds-loader__ring" />
        <div className="ds-loader__ring" />
        <div className="ds-loader__dot" />
      </div>

      {/* Brand */}
      <p className="text-sm font-semibold text-foreground tracking-wide">Dayspring HIS</p>
      <p className="text-xs text-muted-foreground mt-1">Loading, please wait…</p>
    </div>
  )
}
