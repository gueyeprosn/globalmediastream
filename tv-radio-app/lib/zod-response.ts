import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

export function zodErrorResponse(error: ZodError, status = 400) {
  const first = error.issues[0]
  return NextResponse.json(
    {
      error: first?.message ?? 'Requête invalide',
      issues: error.flatten(),
    },
    { status }
  )
}
