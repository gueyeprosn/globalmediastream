import { z } from 'zod'

/** Identifiant de flux pour chemins fichiers et clés d’état. */
export const recordingStreamIdSchema = z
  .string()
  .min(1, 'streamId requis')
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, 'streamId invalide')

export const recordingStartBodySchema = z
  .object({
    streamId: recordingStreamIdSchema,
  })
  .strict()

export type RecordingStartBody = z.infer<typeof recordingStartBodySchema>

export const recordingRenameBodySchema = z
  .object({
    newName: z
      .string()
      .min(1)
      .max(220)
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.mkv$/,
        "Nom cible : lettres, chiffres, . _ - et extension .mkv"
      ),
  })
  .strict()

export type RecordingRenameBody = z.infer<typeof recordingRenameBodySchema>
