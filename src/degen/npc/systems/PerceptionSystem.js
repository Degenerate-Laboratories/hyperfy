import { ProximitySensor } from '../../ai/sensors/ProximitySensor'

/**
 * PerceptionSystem - Manages NPC perception and awareness
 *
 * Wraps proximity sensors and provides convenient access to
 * nearby entities, players, and environmental information.
 *
 * Example usage:
 *   const perception = npc.getSystem('perception')
 *   const nearestPlayer = perception.getNearestPlayer()
 *   if (nearestPlayer) {
 *     console.log('Player nearby:', nearestPlayer.id, nearestPlayer.distance)
 *   }
 */
export class PerceptionSystem {
  /**
   * Create PerceptionSystem
   * @param {Object} [config={}] - Configuration options
   * @param {number} [config.radius=10] - Detection radius
   * @param {number} [config.updateRate=0.2] - Sensor update rate in seconds
   * @param {boolean} [config.detectPlayers=true] - Detect players
   * @param {boolean} [config.detectMobs=false] - Detect other mobs
   */
  constructor(config = {}) {
    this.config = {
      radius: config.radius ?? 10,
      updateRate: config.updateRate ?? 0.2,
      detectPlayers: config.detectPlayers ?? true,
      detectMobs: config.detectMobs ?? false,
      ...config,
    }

    this.npc = null
    this.sensor = null
  }

  init() {
    if (!this.npc) {
      console.error('[PerceptionSystem] init: npc not set')
      return
    }

    if (!this.npc.aiController) {
      console.warn('[PerceptionSystem] init: NPC has no AIController, sensor will not work')
      return
    }

    // Create proximity sensor
    this.sensor = new ProximitySensor({
      radius: this.config.radius,
      updateRate: this.config.updateRate,
      detectPlayers: this.config.detectPlayers,
      detectMobs: this.config.detectMobs,
    })

    // Register sensor with AIController
    this.npc.aiController.registerSensor('proximity', this.sensor)

    console.log(`[PerceptionSystem] ✓ Initialized for NPC ${this.npc.id}`)
  }

  /**
   * Get nearest player
   * @returns {Object|null} { id, distance, type } or null
   */
  getNearestPlayer() {
    if (!this.sensor) return null

    const nearest = this.sensor.getNearestEntity()
    if (nearest && nearest.type === 'player') {
      return nearest
    }

    return null
  }

  /**
   * Get nearest entity (player or mob)
   * @returns {Object|null} { id, distance, type } or null
   */
  getNearestEntity() {
    if (!this.sensor) return null
    return this.sensor.getNearestEntity()
  }

  /**
   * Get all entities in range
   * @returns {Array<Object>} Array of { id, distance, type }
   */
  getEntitiesInRange() {
    if (!this.sensor) return []
    return this.sensor.getEntitiesInRange()
  }

  /**
   * Get all players in range
   * @returns {Array<Object>} Array of { id, distance, type: 'player' }
   */
  getPlayersInRange() {
    if (!this.sensor) return []
    return this.sensor.getEntitiesInRange().filter(e => e.type === 'player')
  }

  /**
   * Get all mobs in range
   * @returns {Array<Object>} Array of { id, distance, type: 'mob' }
   */
  getMobsInRange() {
    if (!this.sensor) return []
    return this.sensor.getEntitiesInRange().filter(e => e.type === 'mob')
  }

  /**
   * Check if any entities are in range
   * @returns {boolean} True if any entities detected
   */
  hasEntitiesInRange() {
    if (!this.sensor) return false
    return this.sensor.hasEntitiesInRange()
  }

  /**
   * Check if any players are in range
   * @returns {boolean} True if any players detected
   */
  hasPlayersInRange() {
    return this.getPlayersInRange().length > 0
  }

  /**
   * Check if any mobs are in range
   * @returns {boolean} True if any mobs detected
   */
  hasMobsInRange() {
    return this.getMobsInRange().length > 0
  }

  /**
   * Get entity by ID from detected entities
   * @param {string} entityId - Entity ID to find
   * @returns {Object|null} { id, distance, type } or null
   */
  getEntityById(entityId) {
    if (!this.sensor) return null

    const entities = this.sensor.getEntitiesInRange()
    return entities.find(e => e.id === entityId) || null
  }

  /**
   * Check if specific entity is in range
   * @param {string} entityId - Entity ID to check
   * @returns {boolean} True if entity is in range
   */
  isEntityInRange(entityId) {
    return this.getEntityById(entityId) !== null
  }

  /**
   * Get distance to specific entity
   * @param {string} entityId - Entity ID
   * @returns {number|null} Distance or null if not in range
   */
  getDistanceToEntity(entityId) {
    const entity = this.getEntityById(entityId)
    return entity ? entity.distance : null
  }

  /**
   * Update perception radius
   * @param {number} radius - New radius
   */
  setRadius(radius) {
    this.config.radius = radius
    if (this.sensor) {
      this.sensor.options.radius = radius
    }
  }

  /**
   * Get current perception radius
   * @returns {number} Current radius
   */
  getRadius() {
    return this.config.radius
  }

  update(delta) {
    // Sensor updates are handled by AIController
  }

  destroy() {
    this.sensor = null
  }
}
