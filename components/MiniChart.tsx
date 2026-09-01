"use client"

type MiniChartProps = {
  data: number[]
  color: string
  height?: number
  unit?: string
  label?: string
}

export function MiniChart({ data, color, height = 58, unit = "", label }: MiniChartProps) {
  const safe = data.slice(-32)
  const max = Math.max(...safe, 1)
  const current = safe.length ? safe[safe.length - 1] : 0
  const formatted =
    typeof current === "number"
      ? `${Number.isInteger(current) ? current : current.toFixed(2)}${unit ? ` ${unit}` : ""}`
      : String(current)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        {label ? <span className="text-xs text-muted-foreground">{label}</span> : <span />}
        <span className="font-mono text-lg font-semibold tabular-nums text-foreground" aria-live="polite">
          {formatted}
        </span>
      </div>
      <div
        className="flex items-end gap-1"
        style={{ height }}
        role="img"
        aria-label={label ? `${label}: ${formatted}` : `Valeur actuelle ${formatted}`}
      >
        {safe.map((point, idx) => (
          <div
            key={`${idx}-${point}`}
            className="flex-1 rounded-t-sm transition-[height] duration-500"
            style={{
              minHeight: 2,
              height: `${Math.max(4, (point / max) * height)}px`,
              backgroundColor: color,
            }}
          />
        ))}
      </div>
    </div>
  )
}
