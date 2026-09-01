import { z } from 'zod'

const portish = z.union([z.number(), z.string(), z.null()]).optional()

/** Corps POST /api/streams/create (champs optionnels selon type). */
export const streamCreateBodySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  type: z.enum(['rtmp', 'srt']),
  inputPort: portish,
  outputPort: portish,
  streamKey: z.union([z.string(), z.null()]).optional(),
  srtMode: z.enum(['relay', 'hls']).optional(),
  autoPort: z.union([z.boolean(), z.string(), z.number()]).optional(),
  passphrase: z.union([z.string(), z.null()]).optional(),
  streamId: z.union([z.string(), z.null()]).optional(),
  latency: z.union([z.number(), z.string(), z.null()]).optional(),
  srtCopy: z.union([z.boolean(), z.string(), z.number()]).optional(),
  outputs: z.array(z.object({ port: z.number().optional() }).passthrough()).optional(),
})

export type StreamCreateBody = z.infer<typeof streamCreateBodySchema>
