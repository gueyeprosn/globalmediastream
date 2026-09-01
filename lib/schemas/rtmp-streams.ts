import { z } from 'zod'

export const rtmpCreateBodySchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(200),
    inputPort: z.coerce.number().int().min(1).max(65535),
    outputPort: z.coerce.number().int().min(0).max(65535).optional(),
    streamKey: z.string().max(500).optional(),
    mode: z.enum(['hls', 'restream']).optional(),
    restreamOutputUrl: z.string().max(2000).optional(),
  })
  .strict()

export type RtmpCreateBody = z.infer<typeof rtmpCreateBodySchema>

export const rtmpUpdateBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    inputPort: z.number().int().min(1).max(65535).optional(),
    outputPort: z.number().int().min(0).max(65535).optional(),
    streamKey: z.string().max(500).optional(),
  })
  .strict()

export type RtmpUpdateBody = z.infer<typeof rtmpUpdateBodySchema>
