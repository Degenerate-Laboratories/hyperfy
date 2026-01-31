import * as THREE from '../extras/three'
import { SnapOctree } from '../extras/SnapOctree'
import { VectorPool } from '../extras/VectorPool'

/**
 * CombatEntityIndex - Centralized entity tracking with O(log n) spatial queries
 *
 * Purpose: Efficiently track and query combat entities using spatial indexing.
 * Replaces O(n) linear scans with O(log n) octree queries.
 *
 * Performance:
 *   - Type filtering: O(1) via Sets (players, mobs)
 *   - Spatial queries: O(log n) via SnapOctree
 *   - Memory: ~8KB for 100 entities
 *
 * Usage:
 *   const index = new CombatEntityIndex(world)
 *   index.register(entity)
 *   const nearest = index.findNearestPlayer([x, y, z], 20)
 *   index.unregister(entityId)
 */
export class CombatEntityIndex {
  constructor(world) {
    this.world = world

    // Type indices for O(1) filtering
    this.players = new Set() // Player entity IDs
    this.mobs = new Set() // Mob entity IDs
    this.all = new Map() // entityId → entity reference

    // Spatial index for O(log n) range queries
    this.spatialIndex = new SnapOctree({
      center: new THREE.Vector3(0, 0, 0),
      size: 500, // 500m world size (auto-expands if needed)
    })

    // Spatial data storage
    // entityId → { id, position: Vector3, active: boolean, type: string }
    this.spatialData = new Map()

    // Vector pool for query operations
    this.vectorPool = new VectorPool(100)
  }

  /**
   * Register entity in the index
   * @param {Object} entity - Entity to register
   */
  register(entity) {
    const id = entity.data.id

    // Store entity reference
    this.all.set(id, entity)

    // Type indexing
    if (entity.isPlayer || entity.data.type === 'player') {
      this.players.add(id)
    } else if (entity.isMob || entity.data.type === 'mob') {
      this.mobs.add(id)
    }

    // Spatial indexing
    const position = new THREE.Vector3().fromArray(entity.data.position)
    const spatialPoint = {
      id,
      position,
      active: true,
      type: entity.data.type,
    }

    this.spatialData.set(id, spatialPoint)
    this.spatialIndex.insert(spatialPoint)
  }

  /**
   * Find nearest player within range (O(log n))
   * @param {Array<number>} position - [x, y, z] position
   * @param {number} maxDistance - Max search radius
   * @returns {{id: string, distance: number}|null} Nearest player or null
   */
  findNearestPlayer(position, maxDistance) {
    const pos = this.vectorPool.acquireFromArray(position)
    const results = this.spatialIndex.query(pos, maxDistance)
    this.vectorPool.release(pos)

    // Filter for players only (results are sorted by distance)
    for (const result of results) {
      if (this.players.has(result.position.id)) {
        return {
          id: result.position.id,
          distance: result.distance,
        }
      }
    }
    return null
  }

  /**
   * Find nearest mob within range (O(log n))
   * @param {Array<number>} position - [x, y, z] position
   * @param {number} maxDistance - Max search radius
   * @returns {{id: string, distance: number}|null} Nearest mob or null
   */
  findNearestMob(position, maxDistance) {
    const pos = this.vectorPool.acquireFromArray(position)
    const results = this.spatialIndex.query(pos, maxDistance)
    this.vectorPool.release(pos)

    // Filter for mobs only (results are sorted by distance)
    for (const result of results) {
      if (this.mobs.has(result.position.id)) {
        return {
          id: result.position.id,
          distance: result.distance,
        }
      }
    }
    return null
  }

  /**
   * Get all players in range (O(log n))
   * @param {Array<number>} position - [x, y, z] position
   * @param {number} radius - Search radius
   * @returns {Array<{id: string, distance: number}>} Players in range (sorted by distance)
   */
  getPlayersInRange(position, radius) {
    const pos = this.vectorPool.acquireFromArray(position)
    const results = this.spatialIndex.query(pos, radius)
    this.vectorPool.release(pos)

    return results
      .filter(r => this.players.has(r.position.id))
      .map(r => ({
        id: r.position.id,
        distance: r.distance,
      }))
      .sort((a, b) => a.distance - b.distance)
  }

  /**
   * Get all mobs in range (O(log n))
   * @param {Array<number>} position - [x, y, z] position
   * @param {number} radius - Search radius
   * @returns {Array<{id: string, distance: number}>} Mobs in range (sorted by distance)
   */
  getMobsInRange(position, radius) {
    const pos = this.vectorPool.acquireFromArray(position)
    const results = this.spatialIndex.query(pos, radius)
    this.vectorPool.release(pos)

    return results
      .filter(r => this.mobs.has(r.position.id))
      .map(r => ({
        id: r.position.id,
        distance: r.distance,
      }))
      .sort((a, b) => a.distance - b.distance)
  }

  /**
   * Update entity position in spatial index
   * @param {string} entityId - Entity ID
   * @param {Array<number>} newPosition - New [x, y, z] position
   */
  updatePosition(entityId, newPosition) {
    const spatialPoint = this.spatialData.get(entityId)
    if (spatialPoint) {
      spatialPoint.position.set(newPosition[0], newPosition[1], newPosition[2])
      this.spatialIndex.move(spatialPoint)
    }
  }

  /**
   * Batch update all entity positions
   * Called from CombatSystem.fixedUpdate() every N frames
   */
  updateAllPositions() {
    this.all.forEach((entity, id) => {
      const spatialPoint = this.spatialData.get(id)
      if (spatialPoint && entity.data.position) {
        const [x, y, z] = entity.data.position
        // Only update if position changed (avoid unnecessary octree updates)
        if (
          spatialPoint.position.x !== x ||
          spatialPoint.position.y !== y ||
          spatialPoint.position.z !== z
        ) {
          spatialPoint.position.set(x, y, z)
          this.spatialIndex.move(spatialPoint)
        }
      }
    })
  }

  /**
   * Unregister entity from index
   * @param {string} entityId - Entity ID to remove
   */
  unregister(entityId) {
    // Remove from entity registry
    this.all.delete(entityId)
    this.players.delete(entityId)
    this.mobs.delete(entityId)

    // Remove from spatial index
    const spatialPoint = this.spatialData.get(entityId)
    if (spatialPoint) {
      this.spatialIndex.remove(spatialPoint)
      this.spatialData.delete(entityId)
    }
  }

  /**
   * Get index statistics
   * @returns {{totalEntities: number, players: number, mobs: number, depth: number}}
   */
  getStats() {
    return {
      totalEntities: this.all.size,
      players: this.players.size,
      mobs: this.mobs.size,
      octreeDepth: this.spatialIndex.getDepth(),
      octreeNodes: this.spatialIndex.getCount(),
    }
  }

  /**
   * Log index statistics (for debugging)
   */
  logStats() {
    const stats = this.getStats()
    console.log(`[CombatEntityIndex] Entities: ${stats.totalEntities}, Players: ${stats.players}, Mobs: ${stats.mobs}`)
    console.log(`[CombatEntityIndex] Octree depth: ${stats.octreeDepth}, nodes: ${stats.octreeNodes}`)
    this.vectorPool.logStats()
  }
}
