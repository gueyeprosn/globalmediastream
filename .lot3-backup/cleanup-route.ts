/**
 * API route pour exécuter le script de nettoyage VPS
 */

import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'
import {
  chmodPlusX,
  fileExecutableViaTest,
  fileExistsViaTest,
  getCleanupScriptPath,
  runCleanupScript,
} from '@/lib/safe-shell'

export interface CleanupResult {
  success: boolean
  output: string
  error?: string
  timestamp: string
}

export async function POST(_request: NextRequest) {
  try {
    const scriptPath = getCleanupScriptPath()

    try {
      const exists = await fileExistsViaTest(scriptPath)
      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            output: '',
            error: `Script non trouvé: ${scriptPath}`,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        )
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          output: '',
          error: `Script non trouvé: ${scriptPath}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }

    try {
      const executable = await fileExecutableViaTest(scriptPath)
      if (!executable) {
        await chmodPlusX(scriptPath)
      }
    } catch {
      try {
        await chmodPlusX(scriptPath)
      } catch {
        /* ignore */
      }
    }

    const timeout = 300000
    const startTime = Date.now()

    try {
      const { stdout, stderr, code } = await runCleanupScript(timeout)
      const output = stdout + (stderr ? `\n\nSTDERR:\n${stderr}` : '')

      if (code !== 0 && code !== null) {
        return NextResponse.json(
          {
            success: false,
            output,
            error: `Le script s'est terminé avec le code ${code}`,
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        output,
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      const err = error as { code?: string; stdout?: string; message?: string }
      if (err.code === 'ETIMEDOUT' || Date.now() - startTime >= timeout) {
        return NextResponse.json(
          {
            success: false,
            output: err.stdout || '',
            error: "Timeout: Le script a pris trop de temps à s'exécuter (> 5 minutes)",
            timestamp: new Date().toISOString(),
          },
          { status: 408 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          output: err.stdout || '',
          error: err.message || "Erreur lors de l'exécution du script",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    logError(_request, 'system/cleanup', 'Erreur inattendue', {
      detail: err.message,
    })
    return NextResponse.json(
      {
        success: false,
        output: '',
        error: err.message || 'Erreur inattendue',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
