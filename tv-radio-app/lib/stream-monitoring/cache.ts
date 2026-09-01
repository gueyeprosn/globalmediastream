/**
 * Système de cache en mémoire pour les métriques de flux
 * Évite de relancer ffprobe trop souvent
 */

interface CachedData<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class StreamMetricsCache {
  private cache: Map<string, CachedData<any>> = new Map()
  private defaultTTL: number = 20000 // 20 secondes par défaut

  /**
   * Récupère une valeur du cache si elle n'est pas expirée
   * @param key Clé du cache
   * @returns Données en cache ou null si expiré/inexistant
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }

    // Vérifier si expiré
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Stocke une valeur dans le cache
   * @param key Clé du cache
   * @param data Données à stocker
   * @param ttl Time to live en millisecondes (défaut: 20s)
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    })
  }

  /**
   * Supprime une entrée du cache
   * @param key Clé du cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Récupère la taille du cache
   */
  size(): number {
    return this.cache.size
  }
}

// Instance singleton
export const streamMetricsCache = new StreamMetricsCache()

// Nettoyage automatique toutes les 30 secondes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    streamMetricsCache.cleanup()
  }, 30000)
}
