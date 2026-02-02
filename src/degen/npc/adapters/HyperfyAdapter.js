/**
 * HyperfyAdapter - Bridges NPCEngine with Hyperfy's entity system
 *
 * Responsibilities:
 * - Create PlayerRemote entities for NPCs (fake players)
 * - Bridge position updates to network sync
 * - Bridge chat to world.chat system
 * - Manage entity lifecycle
 *
 * NPCs are spawned as PlayerRemote entities (fake players) for maximum compatibility
 * with Hyperfy's existing player systems (chat bubbles, nametags, animations, etc.)
 */
export class HyperfyAdapter {
  constructor(world) {
    this.world = world
    this.npcOwnerCounter = 1000 // Counter for generating fake owner IDs
  }

  /**
   * Create a PlayerRemote entity for an NPC
   *
   * NPCs are spawned as "fake players" by giving them an owner ID different from
   * the server's network ID. This makes Hyperfy create a PlayerRemote entity,
   * giving NPCs full player functionality (chat bubbles, nametags, animations, etc.)
   *
   * @param {Object} config - NPC configuration
   * @param {string} config.id - Unique NPC identifier
   * @param {string} config.name - Display name
   * @param {string} [config.avatar] - Avatar URL (.vrm model)
   * @param {Array<number>} [config.spawnPosition] - Initial position [x, y, z]
   * @param {Array<number>} [config.quaternion] - Initial rotation [x, y, z, w]
   * @param {number} [config.health] - Current health
   * @param {number} [config.maxHealth] - Maximum health
   * @param {Object} [config.characterData] - Character definition from registry
   * @returns {PlayerRemote} Created PlayerRemote entity
   */
  async createEntity(config) {
    // Validate server-side only
    if (!this.world.network.isServer) {
      console.warn('[HyperfyAdapter] createEntity should only be called on server')
      return null
    }

    // Generate fake owner ID (makes this a PlayerRemote, not PlayerLocal)
    const ownerId = `npc-${this.npcOwnerCounter++}`

    // Get avatar from config or character data
    const avatar = config.avatar || config.characterData?.model || 'asset://avatar.vrm'

    // Create PlayerRemote entity data
    const playerData = {
      id: config.id,
      type: 'player',
      owner: ownerId, // CRITICAL: Different from server network.id makes this PlayerRemote
      name: config.name || 'NPC',
      avatar: avatar,
      position: config.spawnPosition || [0, 1, 0],
      quaternion: config.quaternion || [0, 0, 0, 1],
      mode: 0, // Locomotion mode: 0=IDLE, 1=WALK, 2=RUN
      axis: [0, 0, 0], // Movement axis
      gaze: [0, 0, 1], // Look direction
      emote: null, // Current emote
      health: config.health ?? config.characterData?.stats?.health ?? 100,
      maxHealth: config.maxHealth ?? config.characterData?.stats?.maxHealth ?? 100,
      rank: 0, // Visitor rank (not admin/builder)
    }

    // Create the entity (local=false for networked entity)
    const entity = this.world.entities.add(playerData, false)

    if (!entity) {
      throw new Error(`Failed to create PlayerRemote entity: ${config.id}`)
    }

    // Register with hot set for regular updates
    this.world.setHot(entity, true)

    console.log(`[HyperfyAdapter] ✓ Created PlayerRemote NPC: ${config.id} (${config.name}) as owner ${ownerId}`)

    return entity
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
   *
   * Uses PlayerRemote's built-in chat() method which displays chat bubbles
   * and sends messages through the player chat system
   *
   * @param {string} npcId - NPC entity ID
   * @param {string} message - Chat message
   */
  chat(npcId, message) {
    if (!this.world.network.isServer) return

    const entity = this.world.entities.get(npcId)
    if (!entity) {
      console.warn(`[HyperfyAdapter] chat: NPC ${npcId} not found`)
      return
    }

    // Use PlayerRemote's chat method (shows bubble + sends to chat)
    if (entity.chat) {
      entity.chat(message)
    } else {
      // Fallback to world chat if entity doesn't have chat method
      if (this.world.chat) {
        this.world.chat.add(
          {
            from: entity.data.name || 'NPC',
            fromId: npcId,
            body: message,
          },
          true // broadcast to all clients
        )
      }
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
