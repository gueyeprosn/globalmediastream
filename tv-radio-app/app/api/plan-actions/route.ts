import { NextRequest, NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { requireAuth } from '@/lib/require-auth'

export const runtime = "nodejs"

type Priority = "P1" | "P2" | "P3"
type Status = "a_faire" | "en_cours" | "termine"

type ActionItem = {
  id: string
  docSection: string
  page: string
  api: string
  priority: Priority
  status: Status
  scope: string
}

const DATA_DIR = path.join(process.cwd(), "data")
const DATA_FILE = path.join(DATA_DIR, "plan-actions.json")

const DEFAULT_ITEMS: ActionItem[] = [
  {
    id: "A-01",
    docSection: "Runbook incidents",
    page: "/incidents",
    api: "N/A",
    priority: "P1",
    status: "termine",
    scope: "Creer une base operateur avec checklist + commandes copiables.",
  },
  {
    id: "A-02",
    docSection: "Supervision flux",
    page: "/monitoring",
    api: "/api/system/metrics",
    priority: "P1",
    status: "termine",
    scope: "Ajouter des seuils visuels CPU/RAM/disque et un etat de sante synthetique.",
  },
  {
    id: "A-03",
    docSection: "Exploitation streaming",
    page: "/",
    api: "/api/streams, /api/srs/sessions",
    priority: "P1",
    status: "termine",
    scope: "Finaliser les actions rapides orientees incidents et rollback operateur.",
  },
  {
    id: "A-04",
    docSection: "Creation points RTMP/SRT",
    page: "/",
    api: "/api/streams/create, /api/streams/:id",
    priority: "P1",
    status: "termine",
    scope: "Ajouter tests fonctionnels de lecture + etats plus explicites apres controle.",
  },
  {
    id: "A-05",
    docSection: "Qualite UX desktop",
    page: "/settings",
    api: "N/A",
    priority: "P2",
    status: "termine",
    scope: "Ameliorer densite/espacement des cartes laterales en grand ecran.",
  },
  {
    id: "A-06",
    docSection: "Logs & diagnostic",
    page: "/logs",
    api: "/api/logs",
    priority: "P2",
    status: "termine",
    scope: "Ajouter presets de filtres (service, niveau, fenetre temporelle).",
  },
  {
    id: "A-07",
    docSection: "Parametres exploitation",
    page: "/settings",
    api: "N/A",
    priority: "P3",
    status: "termine",
    scope: "Ajouter mode guide (assistant) pour onboarding operateur junior.",
  },
]

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(DATA_FILE, "utf8")
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(DEFAULT_ITEMS, null, 2), "utf8")
  }
}

async function readItems(): Promise<ActionItem[]> {
  await ensureDataFile()
  try {
    const raw = await readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(raw) as ActionItem[]
    return Array.isArray(parsed) ? parsed : DEFAULT_ITEMS
  } catch {
    return DEFAULT_ITEMS
  }
}

async function writeItems(items: ActionItem[]) {
  await ensureDataFile()
  await writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8")
}

export async function GET(request: NextRequest){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  const items = await readItems()
  return NextResponse.json({ items })
}

export async function PATCH(request: Request){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const body = (await request.json()) as {
      id?: string
      priority?: Priority
      status?: Status
      scope?: string
      move?: "up" | "down"
    }
    if (!body?.id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }

    const items = await readItems()
    const index = items.findIndex((item) => item.id === body.id)
    if (index < 0) {
      return NextResponse.json({ error: "item introuvable" }, { status: 404 })
    }

    if (body.move === "up" || body.move === "down") {
      const targetIndex = body.move === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= items.length) {
        return NextResponse.json({ success: true, items })
      }
      const next = [...items]
      const current = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = current
      await writeItems(next)
      return NextResponse.json({ success: true, items: next })
    }

    const current = items[index]
    const updated: ActionItem = {
      ...current,
      priority: body.priority ?? current.priority,
      status: body.status ?? current.status,
      scope: typeof body.scope === "string" ? body.scope.trim() || current.scope : current.scope,
    }

    items[index] = updated
    await writeItems(items)

    return NextResponse.json({ success: true, item: updated })
  } catch {
    return NextResponse.json({ error: "requete invalide" }, { status: 400 })
  }
}

function getNextId(items: ActionItem[]): string {
  let max = 0
  for (const item of items) {
    const match = /^A-(\d+)$/.exec(item.id)
    if (!match) continue
    const value = Number(match[1])
    if (!Number.isNaN(value)) {
      max = Math.max(max, value)
    }
  }
  return `A-${String(max + 1).padStart(2, "0")}`
}

export async function POST(request: Request){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const body = (await request.json()) as {
      docSection?: string
      page?: string
      api?: string
      priority?: Priority
      status?: Status
      scope?: string
    }

    const docSection = String(body?.docSection || "").trim()
    const page = String(body?.page || "").trim()
    const api = String(body?.api || "").trim()
    const scope = String(body?.scope || "").trim()
    const priority = body?.priority
    const status = body?.status

    if (!docSection || !page || !api || !scope) {
      return NextResponse.json({ error: "champs obligatoires manquants" }, { status: 400 })
    }

    if (!priority || !["P1", "P2", "P3"].includes(priority)) {
      return NextResponse.json({ error: "priorite invalide" }, { status: 400 })
    }

    if (!status || !["a_faire", "en_cours", "termine"].includes(status)) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 })
    }

    const items = await readItems()
    const newItem: ActionItem = {
      id: getNextId(items),
      docSection,
      page,
      api,
      priority,
      status,
      scope,
    }

    const next = [newItem, ...items]
    await writeItems(next)
    return NextResponse.json({ success: true, item: newItem, items: next })
  } catch {
    return NextResponse.json({ error: "requete invalide" }, { status: 400 })
  }
}

export async function DELETE(request: Request){
  const __auth = await requireAuth(request)
  if (!__auth.ok) return __auth.response

  try {
    const body = (await request.json()) as { id?: string }
    const id = String(body?.id || "").trim()
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }

    const items = await readItems()
    const next = items.filter((item) => item.id !== id)
    if (next.length === items.length) {
      return NextResponse.json({ error: "item introuvable" }, { status: 404 })
    }

    await writeItems(next)
    return NextResponse.json({ success: true, items: next })
  } catch {
    return NextResponse.json({ error: "requete invalide" }, { status: 400 })
  }
}
