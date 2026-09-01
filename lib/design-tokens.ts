/** Spacing / density helpers aligned with the premium dark dashboard. */

export const densityPadding = {
  comfortable: "p-4 sm:p-6 lg:p-8",
  compact: "p-3 sm:p-4 lg:p-5",
} as const

export const pageGap = "space-y-6"
export const sectionGap = "space-y-4"
export const cardRadius = "rounded-xl"
export const maxContentWidth = "max-w-[1600px]"

export const statusTone = {
  live: "live",
  idle: "idle",
  error: "error",
  warn: "warn",
  rec: "rec",
  neutral: "neutral",
} as const

export type UiDensity = keyof typeof densityPadding
