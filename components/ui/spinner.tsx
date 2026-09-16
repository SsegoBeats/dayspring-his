import { cn } from '@/lib/utils'

/**
 * Clean single-arc spinning loader.
 * Drop-in replacement for the old Lucide Loader2 spinner.
 * Accepts the same className prop as before.
 */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    >
      {/* Track */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.18"
      />
      {/* Arc */}
      <path
        d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export { Spinner }
