/**
 * API route pour récupérer les métriques système du VPS
 * CPU, RAM, Disque, Réseau, Processus, Services
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface SystemMetrics {
  // CPU
  cpuUsage: number // Pourcentage
  cpuLoad: {
    load1: number
    load5: number
    load15: number
  }
  
  // Mémoire
  memory: {
    total: number // MB
    used: number // MB
    free: number // MB
    cached: number // MB
    percentage: number // Pourcentage
  }
  
  // Disque
  disk: {
    total: number // GB
    used: number // GB
    free: number // GB
    percentage: number // Pourcentage
    mountPoint: string
  }
  
  // Réseau
  network: {
    interfaces: Array<{
      name: string
      rxBytes: number // Bytes reçus
      txBytes: number // Bytes envoyés
    }>
  }
  
  // Processus
  processes: {
    total: number
    running: number
    sleeping: number
    zombie: number
  }
  
  // Services système
  services: {
    nginx: 'active' | 'inactive'
    pm2: 'active' | 'inactive'
    icecast2: 'active' | 'inactive'
  }

  // Conteneurs Docker streaming
  docker: {
    srs: 'running' | 'stopped' | 'unknown'
    oryx: 'running' | 'stopped' | 'unknown'
  }
  
  // Uptime
  uptime: string // Format: "X days, Y hours, Z minutes"
  
  // Timestamp
  timestamp: string
}

/**
 * Parse la sortie de `free -m` pour obtenir les métriques mémoire
 */
async function getMemoryMetrics(): Promise<SystemMetrics['memory']> {
  try {
    const { stdout } = await execAsync('free -m')
    const lines = stdout.split('\n')
    const memLine = lines[1].split(/\s+/)
    
    const total = parseInt(memLine[1])
    const used = parseInt(memLine[2])
    const free = parseInt(memLine[3])
    // free -m columns: Mem: total used free shared buff/cache available
    // Ici memLine[6] correspond à `available`, et memLine[5] correspond à `buff/cache`.
    const cached = parseInt(memLine[5]) || 0
    
    return {
      total,
      used,
      free,
      cached,
      percentage: Math.round((used / total) * 100),
    }
  } catch {
    return {
      total: 0,
      used: 0,
      free: 0,
      cached: 0,
      percentage: 0,
    }
  }
}

/**
 * Parse la sortie de `df -h` pour obtenir les métriques disque
 */
async function getDiskMetrics(): Promise<SystemMetrics['disk']> {
  try {
    const { stdout } = await execAsync("df -BG / | tail -1 | awk '{print $2,$3,$4,$5,$6}'")
    const parts = stdout.trim().split(/\s+/)
    
    const total = parseFloat(parts[0].replace('G', ''))
    const used = parseFloat(parts[1].replace('G', ''))
    const free = parseFloat(parts[2].replace('G', ''))
    const percentage = parseInt(parts[3].replace('%', ''))
    const mountPoint = parts[4] || '/'
    
    return {
      total,
      used,
      free,
      percentage,
      mountPoint,
    }
  } catch {
    return {
      total: 0,
      used: 0,
      free: 0,
      percentage: 0,
      mountPoint: '/',
    }
  }
}

/**
 * Récupère l'utilisation CPU via `top` ou `vmstat`
 */
async function getCpuUsage(): Promise<number> {
  try {
    // Utiliser vmstat pour obtenir l'utilisation CPU
    const { stdout } = await execAsync('vmstat 1 2 | tail -1')
    const parts = stdout.trim().split(/\s+/)
    const idle = parseFloat(parts[14])
    return Math.round(100 - idle)
  } catch {
    try {
      // Alternative: utiliser top
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'")
      return parseFloat(stdout.trim()) || 0
    } catch {
      return 0
    }
  }
}

/**
 * Récupère la charge système
 */
async function getCpuLoad(): Promise<SystemMetrics['cpuLoad']> {
  try {
    const { stdout } = await execAsync('uptime')
    const match = stdout.match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/)
    if (match) {
      return {
        load1: parseFloat(match[1]),
        load5: parseFloat(match[2]),
        load15: parseFloat(match[3]),
      }
    }
  } catch {}
  
  return { load1: 0, load5: 0, load15: 0 }
}

/**
 * Récupère les statistiques réseau
 */
async function getNetworkMetrics(): Promise<SystemMetrics['network']> {
  try {
    const { stdout } = await execAsync('cat /proc/net/dev | grep -E "eth0|ens|enp" | head -2')
    const interfaces: SystemMetrics['network']['interfaces'] = []
    
    for (const line of stdout.split('\n').filter(Boolean)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 10) {
        interfaces.push({
          name: parts[0].replace(':', ''),
          rxBytes: parseInt(parts[1]) || 0,
          txBytes: parseInt(parts[9]) || 0,
        })
      }
    }
    
    return { interfaces }
  } catch {
    return { interfaces: [] }
  }
}

/**
 * Récupère les statistiques des processus
 */
async function getProcessMetrics(): Promise<SystemMetrics['processes']> {
  try {
    const { stdout } = await execAsync('ps aux | wc -l')
    const total = parseInt(stdout.trim()) - 1 // Exclure l'en-tête
    
    // Utiliser ps -eo stat pour éviter que grep se compte lui-même
    const { stdout: runningOut } = await execAsync("ps -eo stat | grep -c '^R' || echo 0")
    const running = parseInt(runningOut.trim())
    
    const { stdout: sleepingOut } = await execAsync("ps -eo stat | grep -c '^S' || echo 0")
    const sleeping = parseInt(sleepingOut.trim())
    
    // Compter les processus zombies - méthode robuste qui évite de compter grep
    // Utiliser ps avec format spécifique et awk pour compter uniquement les lignes avec Z dans la colonne stat
    const { stdout: zombieOut } = await execAsync("ps -eo stat --no-headers | awk '/Z/ {count++} END {print count+0}'")
    const zombie = parseInt(zombieOut.trim()) || 0
    
    return {
      total,
      running,
      sleeping,
      zombie,
    }
  } catch {
    return {
      total: 0,
      running: 0,
      sleeping: 0,
      zombie: 0,
    }
  }
}

/**
 * Vérifie le statut des services système
 */
async function getDockerStatus(): Promise<SystemMetrics['docker']> {
  const inspect = async (name: string): Promise<'running' | 'stopped' | 'unknown'> => {
    try {
      const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${name} 2>/dev/null`)
      return stdout.trim() === 'true' ? 'running' : 'stopped'
    } catch {
      return 'unknown'
    }
  }

  const [srs, oryx] = await Promise.all([inspect('srs'), inspect('oryx')])
  return { srs, oryx }
}

async function getServicesStatus(): Promise<SystemMetrics['services']> {
  const checkService = async (service: string): Promise<'active' | 'inactive'> => {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${service} 2>/dev/null || echo inactive`)
      return stdout.trim() === 'active' ? 'active' : 'inactive'
    } catch {
      return 'inactive'
    }
  }
  
  // Vérifier PM2 différemment
  const checkPM2 = async (): Promise<'active' | 'inactive'> => {
    try {
      await execAsync('pm2 list > /dev/null 2>&1')
      return 'active'
    } catch {
      return 'inactive'
    }
  }
  
  return {
    nginx: await checkService('nginx'),
    pm2: await checkPM2(),
    icecast2: await checkService('icecast2'),
  }
}

/**
 * Récupère l'uptime du système
 */
async function getUptime(): Promise<string> {
  try {
    const { stdout } = await execAsync('uptime -p')
    return stdout.trim().replace('up ', '')
  } catch {
    try {
      const { stdout } = await execAsync('cat /proc/uptime')
      const seconds = parseFloat(stdout.split(' ')[0])
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${days} days, ${hours} hours, ${minutes} minutes`
    } catch {
      return 'Unknown'
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Récupérer toutes les métriques en parallèle
    const [
      cpuUsage,
      cpuLoad,
      memory,
      disk,
      network,
      processes,
      services,
      docker,
      uptime,
    ] = await Promise.all([
      getCpuUsage(),
      getCpuLoad(),
      getMemoryMetrics(),
      getDiskMetrics(),
      getNetworkMetrics(),
      getProcessMetrics(),
      getServicesStatus(),
      getDockerStatus(),
      getUptime(),
    ])
    
    const metrics: SystemMetrics = {
      cpuUsage,
      cpuLoad,
      memory,
      disk,
      network,
      processes,
      services,
      docker,
      uptime,
      timestamp: new Date().toISOString(),
    }
    
    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (error: any) {
    console.error('Erreur lors de la récupération des métriques système:', error)
    return NextResponse.json(
      {
        error: error.message || 'Erreur lors de la récupération des métriques système',
      },
      { status: 500 }
    )
  }
}
