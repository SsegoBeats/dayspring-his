"use client"

import { useEffect } from "react"
import { useFormatCurrency } from "@/lib/settings-context"

interface PaymentSuccessScreenProps {
  amount: number
  method: string
  paymentType: "full" | "partial" | "split"
  onComplete: () => void
}

const CONFETTI_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#fb7185"]

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function PaymentSuccessScreen({ amount, method, paymentType, onComplete }: PaymentSuccessScreenProps) {
  const formatCurrency = useFormatCurrency()

  useEffect(() => {
    const t = setTimeout(onComplete, 1800)
    return () => clearTimeout(t)
  }, [onComplete])

  const message =
    paymentType === "full"    ? "Payment received"          :
    paymentType === "partial" ? "Partial payment recorded"  :
                                "Split payment recorded"

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center motion-safe:animate-[fade-in_300ms]"
      style={{ background: "radial-gradient(ellipse at center, #d1fae5 0%, #e0f2fe 100%)" }}
    >
      {/* Skip button */}
      <button
        type="button"
        onClick={onComplete}
        className="absolute right-3 top-3 cursor-pointer text-xs text-black/40 hover:text-black/70"
      >
        Skip →
      </button>

      {/* Confetti (full payment only) */}
      {paymentType === "full" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="absolute motion-safe:animate-[confetti-fly_700ms_200ms_ease-out_forwards]"
              style={{
                width:  `${randomBetween(6, 10)}px`,
                height: `${randomBetween(6, 10)}px`,
                borderRadius: i % 3 === 0 ? "50%" : "2px",
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                left:  `${randomBetween(20, 80)}%`,
                top:   `${randomBetween(20, 60)}%`,
                "--dx": `${randomBetween(-120, 120)}px`,
                "--dy": `${randomBetween(40, 180)}px`,
                "--dr": `${randomBetween(-360, 360)}deg`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Circle + checkmark */}
      <div className="relative flex items-center justify-center">
        {/* Partial ring pulse */}
        {paymentType === "partial" && (
          <div className="absolute inset-0 m-auto h-24 w-24 rounded-full motion-safe:animate-[ring-pulse_600ms_200ms_ease-out]" />
        )}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-xl motion-safe:animate-[circle-pop_600ms_ease-out]">
          <svg viewBox="0 0 52 52" className="h-12 w-12" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M14 27l9 9 16-18"
              strokeDasharray={100}
              strokeDashoffset={100}
              className="motion-safe:animate-[checkmark-draw_500ms_100ms_ease-out_forwards]"
            />
          </svg>
        </div>
      </div>

      {/* Message */}
      <p className="mt-6 text-lg font-semibold text-emerald-900 opacity-0 motion-safe:animate-[slide-up_300ms_500ms_ease-out_forwards]">
        {message}
      </p>

      {/* Amount */}
      <p className="mt-2 text-3xl font-bold text-emerald-700 opacity-0 motion-safe:animate-[slide-up_300ms_600ms_ease-out_forwards]">
        {formatCurrency(amount)}
      </p>

      {/* Method */}
      <p className="mt-1 text-sm text-emerald-800/70 opacity-0 motion-safe:animate-[slide-up_300ms_650ms_ease-out_forwards]">
        {method}
      </p>
    </div>
  )
}
