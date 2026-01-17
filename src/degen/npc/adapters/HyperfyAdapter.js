/**
 * HyperfyAdapter - Bridges NPCEngine with Hyperfy's Mob entity system
 *
 * Responsibilities:
 * - Create Mob entities via world.entities.add()
 * - Bridge position updates to network sync
 * - Bridge chat to world.chat system
 * - Manage entity lifecycle
 */
export class HyperfyAdapter {
  constructor(world) {
    this.world = world
  }

  /**
   * Create a Mob entity
   * @param {Object} config - NPC configuration
   * @param {string} config.id - Unique NPC identifier
   * @param {string} config.name - Display name
   * @param {Array<number>} [config.spawnPosition] - Initial position [x, y, z]
   * @param {Array<number>} [config.quaternion] - Initial rotation [x, y, z, w]
   * @param {number} [config.health] - Current health
   * @param {number} [config.maxHealth] - Maximum health
   * @param {string} [config.blueprint] - Blueprint name (optional)
   * @returns {Mob} Created mob entity
   */
  async createEntity(config) {
    // Validate server-side only
    if (!this.world.network.isServer) {
      console.warn('[HyperfyAdapter] createEntity should only be called on server')
      return null
    }

    // Create Mob entity data
    const mobData = {
      type: 'mob',
      id: config.id,
      name: config.name || 'NPC',
      position: config.spawnPosition || [0, 1, 0],
      quaternion: config.quaternion || [0, 0, 0, 1],
      health: config.health ?? 100,
      maxHealth: config.maxHealth ?? 100,
      mover: 'server', // Server-authoritative movement
    }

    // Add blueprint if specified
    if (config.blueprint) {
      mobData.blueprint = config.blueprint
    }

    // Create the entity (local=false for networked entity)
    const mob = this.world.entities.add(mobData, false)

    if (!mob) {
      throw new Error(`Failed to create mob entity: ${config.id}`)
    }

    // Register with hot set for regular updates
    this.world.setHot(mob, true)

    console.log(`[HyperfyAdapter] ✓ Created mob: ${config.id} (${config.name})`)

    return mob
  }

  /**
   * Update entity position and locomotion state
   * @param {string} id - Entity ID
   * @param {Array<number>} position - New position [x, y, z]
   * @param {Object} [locomotion] - Locomotion state
   * @param {number} [locomotion.mode] - 0=IDLE, 1=WALK, 2=RUN
   * @param {Array<number>} [locomotion.axis] - Movement direction
   * @param {Array<number>} [locomotion.gaze] - Look direction
   * @param {Array<number>} [locomotion.quaternion] - Rotation quaternion
   */
  updatePosition(id, position, locomotion) {
    if (!this.world.network.isServer) return

    const data = {
      id,
      p: position,
    }

    // Add locomotion data if provided
    if (locomotion) {
      if (locomotion.mode !== undefined) data.m = locomotion.mode
      if (locomotion.axis) data.a = locomotion.axis
      if (locomotion.gaze) data.g = locomotion.gaze
      if (locomotion.quaternion) data.q = locomotion.quaternion
    }

    // Broadcast update to clients
    this.world.network.send('entityModified', data)
  }

  /**
   * Send chat message from NPC
   * @param {string} npcId - NPC entity ID
   * @param {string} message - Chat message
   */
  chat(npcId, message) {
    if (!this.world.network.isServer) return

    const mob = this.world.entities.get(npcId)
    if (!mob) {
      console.warn(`[HyperfyAdapter] chat: NPC ${npcId} not found`)
      return
    }

    // Use world chat system
    if (this.world.chat) {
      this.world.chat.add(
        {
          from: mob.data.name || 'NPC',
          fromId: null, // null indicates system/NPC message
          body: message,
        },
        true // broadcast to all clients
      )
    }
  }

  /**
   * Destroy entity
   * @param {string} id - Entity ID
   */
  destroyEntity(id) {
    if (!this.world.network.isServer) return

    const mob = this.world.entities.get(id)
    if (mob) {
      // Unregister from hot set
      this.world.setHot(mob, false)

      // Destroy entity
      mob.destroy()

      console.log(`[HyperfyAdapter] ✓ Destroyed mob: ${id}`)
    }
  }

  /**
   * Get entity by ID
   * @param {string} id - Entity ID
   * @returns {Mob|null} Mob entity or null
   */
  getEntity(id) {
    return this.world.entities.get(id)
  }

  /**
   * Check if entity exists
   * @param {string} id - Entity ID
   * @returns {boolean} True if entity exists
   */
  hasEntity(id) {
    return this.world.entities.has(id)
  }
}
