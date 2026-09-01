import { describe, expect, it } from 'vitest'
import { recordingRenameBodySchema, recordingStartBodySchema } from './recordings'

describe('recordingStartBodySchema', () => {
  it('accepts valid streamId', () => {
    const r = recordingStartBodySchema.safeParse({ streamId: 'toubatv' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid streamId', () => {
    expect(recordingStartBodySchema.safeParse({ streamId: '' }).success).toBe(false)
    expect(recordingStartBodySchema.safeParse({ streamId: '../../../x' }).success).toBe(
      false
    )
  })
})

describe('recordingRenameBodySchema', () => {
  it('accepts valid mkv name', () => {
    expect(recordingRenameBodySchema.safeParse({ newName: 'external-tv-20250101-120000.mkv' }).success).toBe(true)
  })
  it('rejects invalid names', () => {
    expect(recordingRenameBodySchema.safeParse({ newName: 'x' }).success).toBe(false)
    expect(recordingRenameBodySchema.safeParse({ newName: '../x.mkv' }).success).toBe(false)
    expect(recordingRenameBodySchema.safeParse({ newName: 'bad.mp4' }).success).toBe(false)
  })
})
