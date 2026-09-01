"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Network, 
  Activity,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { usePolling } from "@/hooks/usePolling"
import { apiFetch } from "@/lib/api-fetch"

interface SystemMetrics {
  cpuUsage: number
  cpuLoad: {
    load1: number
    load5: number
    load15: number
  }
  memory: {
    total: number
    used: number
    free: number
    cached: number
    percentage: number
  }
  disk: {
    total: number
    used: number
    free: number
    percentage: number
    mountPoint: string
  }
  network: {
    interfaces: Array<{
      name: string
      rxBytes: number
      txBytes: number
    }>
  }
  processes: {
    total: number
    running: number
    sleeping: number
    zombie: number
  }
  services: {
    nginx: 'active' | 'inactive'
    pm2: 'active' | 'inactive'
    icecast2: 'active' | 'inactive'
  }
  uptime: string
  timestamp: string
}

interface CleanupResult {
  success: boolean
  output: string
  error?: string
  timestamp: string
}

export function SystemMonitor() {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)

  const fetchMetrics = async () => {
    const response = await apiFetch('/api/system/metrics', {
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    setLastUpdate(new Date())
    return data
  }

  const { data: metrics, loading, error } = usePolling(fetchMetrics, 10000, true)

  const handleCleanup = async () => {
    setCleanupLoading(true)
    setCleanupResult(null)

    try {
      const response = await apiFetch('/api/system/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data: CleanupResult = await response.json()
      setCleanupResult(data)

      // Rafraîchir les métriques après le cleanup
      if (data.success) {
        toast.success('Nettoyage réussi', {
          description: 'Le VPS a été nettoyé avec succès',
          duration: 5000,
        })
        // Le polling se chargera de rafraîchir automatiquement
      } else {
        toast.error('Erreur lors du nettoyage', {
          description: data.error || 'Une erreur est survenue',
          duration: 5000,
        })
      }
    } catch (error: any) {
      toast.error('Erreur', {
        description: error.message || 'Une erreur inattendue est survenue',
        duration: 5000,
      })
      setCleanupResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setCleanupLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatGB = (gb: number): string => {
    return `${gb.toFixed(2)} GB`
  }

  const formatMB = (mb: number): string => {
    return `${mb.toFixed(0)} MB`
  }

  if (loading && !metrics) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Chargement des métriques système...</span>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Impossible de charger les métriques système: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Impossible de charger les métriques système. Vérifiez que les commandes système sont disponibles.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Système VPS</h1>
          <p className="text-muted-foreground mt-1">
            Dernière mise à jour: {lastUpdate?.toLocaleTimeString('fr-FR') || 'Jamais'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchMetrics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={cleanupLoading}
              >
                {cleanupLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Nettoyage en cours...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Nettoyer le VPS
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer le nettoyage</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir exécuter le nettoyage complet du VPS ? 
                  Cette action peut prendre plusieurs minutes et supprimera les anciens logs et backups.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleCleanup}>
                  Confirmer le nettoyage
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Résultat du cleanup */}
      {cleanupResult && (
        <Alert variant={cleanupResult.success ? "default" : "destructive"}>
          {cleanupResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="font-semibold mb-2">
              {cleanupResult.success ? 'Nettoyage réussi' : 'Erreur lors du nettoyage'}
            </div>
            {cleanupResult.error && (
              <div className="text-sm text-red-600 mb-2">{cleanupResult.error}</div>
            )}
            {cleanupResult.output && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">Voir les détails</summary>
                <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                  {cleanupResult.output}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpuUsage}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              Charge: {metrics.cpuLoad.load1.toFixed(2)} / {metrics.cpuLoad.load5.toFixed(2)} / {metrics.cpuLoad.load15.toFixed(2)}
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min(metrics.cpuUsage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Mémoire */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mémoire</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.memory.percentage}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatMB(metrics.memory.used)} / {formatMB(metrics.memory.total)}
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min(metrics.memory.percentage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Disque */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disque</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.disk.percentage}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatGB(metrics.disk.used)} / {formatGB(metrics.disk.total)}
            </div>
            <div className="mt-2 w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  metrics.disk.percentage > 90 ? 'bg-destructive' :
                  metrics.disk.percentage > 75 ? 'bg-orange-500' :
                  'bg-primary'
                }`}
                style={{ width: `${Math.min(metrics.disk.percentage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{metrics.uptime}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Système en ligne
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détails supplémentaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Processus */}
        <Card>
          <CardHeader>
            <CardTitle>Processus</CardTitle>
            <CardDescription>Statistiques des processus système</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Total:</span>
              <span className="font-medium">{metrics.processes.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">En cours:</span>
              <Badge variant="default">{metrics.processes.running}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">En veille:</span>
              <Badge variant="secondary">{metrics.processes.sleeping}</Badge>
            </div>
            {metrics.processes.zombie > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-destructive">Zombies:</span>
                <Badge variant="destructive">{metrics.processes.zombie}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle>Services Système</CardTitle>
            <CardDescription>Statut des services critiques</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Nginx:</span>
              <Badge variant={metrics.services.nginx === 'active' ? 'default' : 'destructive'}>
                {metrics.services.nginx === 'active' ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">PM2:</span>
              <Badge variant={metrics.services.pm2 === 'active' ? 'default' : 'destructive'}>
                {metrics.services.pm2 === 'active' ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Icecast2:</span>
              <Badge variant={metrics.services.icecast2 === 'active' ? 'default' : 'destructive'}>
                {metrics.services.icecast2 === 'active' ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Réseau */}
      {metrics.network.interfaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Réseau
            </CardTitle>
            <CardDescription>Statistiques des interfaces réseau</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.network.interfaces.map((iface: { name: string; rxBytes: number; txBytes: number }) => (
                <div key={iface.name} className="border rounded-lg p-3">
                  <div className="font-medium mb-2">{iface.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reçu:</span>
                      <span className="ml-2 font-medium">{formatBytes(iface.rxBytes)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Envoyé:</span>
                      <span className="ml-2 font-medium">{formatBytes(iface.txBytes)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
