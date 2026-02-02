import { EventBus } from './events/EventBus'
import { NPC } from './NPC'
import { AIController } from '../../ai/AIController'

/**
 * NPCEngine - Main orchestrator for NPC system
 *
 * Responsibilities:
 * - Manage NPC lifecycle (spawn/despawn)
 * - System registration and factory management
 * - Update loop coordination
 * - Event bus management
 */
export class NPCEngine {
  /**
   * Create NPCEngine
   * @param {HyperfyAdapter} adapter - Platform adapter for entity management
   */
  constructor(adapter) {
    this.adapter = adapter
    this.npcs = new Map()
    this.systemFactories = new Map()
    this.eventBus = new EventBus()
    this.isRunning = false
  }

  /**
   * Register a system factory
   * @param {string} name - System name
   * @param {Function} factory - Factory function that creates system instances
   */
  registerSystem(name, factory) {
    if (this.systemFactories.has(name)) {
      console.warn(`[NPCEngine] System ${name} already registered, overwriting`)
    }
    this.systemFactories.set(name, factory)
    console.log(`[NPCEngine] ✓ Registered system: ${name}`)
  }

  /**
   * Spawn a new NPC
   * @param {Object} config - NPC configuration
   * @param {string} config.id - Unique NPC identifier
   * @param {string} config.name - Display name
   * @param {Array<number>} [config.spawnPosition] - Initial position
   * @param {Array<number>} [config.quaternion] - Initial rotation
   * @param {number} [config.health] - Current health
   * @param {number} [config.maxHealth] - Maximum health
   * @param {string} [config.blueprint] - Blueprint name
   * @param {Object} [config.systems] - System configurations
   * @param {Object} [config.aiController] - AIController configuration
   * @returns {Promise<NPC>} Spawned NPC instance
   */
  async spawn(config) {
    // Validate config
    if (!config.id) {
      throw new Error('[NPCEngine] spawn: config.id is required')
    }

    if (this.npcs.has(config.id)) {
      throw new Error(`[NPCEngine] spawn: NPC ${config.id} already exists`)
    }

    console.log(`[NPCEngine] Spawning NPC: ${config.id}`)

    try {
      // Create Mob entity via adapter
      const mob = await this.adapter.createEntity(config)

      if (!mob) {
        throw new Error(`Failed to create entity for NPC ${config.id}`)
      }

      // Create AIController if configured
      let aiController = null
      if (config.aiController !== false) {
        // Default to creating AIController unless explicitly disabled
        aiController = new AIController(mob)
        console.log(`[NPCEngine] ✓ Created AIController for ${config.id}`)
      }

      // Create NPC container
      const npc = new NPC(config.id, config, mob, aiController)

      // Attach systems
      if (config.systems) {
        for (const [systemName, systemConfig] of Object.entries(config.systems)) {
          // Skip if system is explicitly disabled
          if (systemConfig.enabled === false) {
            continue
          }

          // Get system factory
          const factory = this.systemFactories.get(systemName)
          if (!factory) {
            console.warn(`[NPCEngine] System factory not found: ${systemName}`)
            continue
          }

          try {
            // Create system instance
            const system = factory(systemConfig)
            npc.addSystem(systemName, system)
          } catch (error) {
            console.error(`[NPCEngine] Failed to create system ${systemName}:`, error)
          }
        }
      }

      // Register NPC
      this.npcs.set(config.id, npc)

      // Emit event
      this.eventBus.emit('NPC_SPAWNED', { npcId: config.id, npc })

      console.log(`[NPCEngine] ✓ Spawned NPC: ${config.id} (${config.name})`)

      return npc
    } catch (error) {
      console.error(`[NPCEngine] Failed to spawn NPC ${config.id}:`, error)
      throw error
    }
  }

  /**
   * Despawn an NPC
   * @param {string} id - NPC identifier
   * @returns {boolean} True if NPC was despawned
   */
  despawn(id) {
    const npc = this.npcs.get(id)
    if (!npc) {
      console.warn(`[NPCEngine] despawn: NPC ${id} not found`)
      return false
    }

    console.log(`[NPCEngine] Despawning NPC: ${id}`)

    try {
      // Destroy NPC (destroys systems and AIController)
      npc.destroy()

      // Destroy entity via adapter
      this.adapter.destroyEntity(id)

      // Unregister NPC
      this.npcs.delete(id)

      // Emit event
      this.eventBus.emit('NPC_DESTROYED', { npcId: id })

      console.log(`[NPCEngine] ✓ Despawned NPC: ${id}`)

      return true
    } catch (error) {
      console.error(`[NPCEngine] Failed to despawn NPC ${id}:`, error)
      return false
    }
  }

  /**
   * Get NPC by ID
   * @param {string} id - NPC identifier
   * @returns {NPC|undefined} NPC instance
   */
  getNPC(id) {
    return this.npcs.get(id)
  }

  /**
   * Get all NPCs
   * @returns {Map<string, NPC>} Map of all NPCs
   */
  getAllNPCs() {
    return this.npcs
  }

  /**
   * Get NPCs as array
   * @returns {Array<NPC>} Array of NPCs
   */
  getNPCsArray() {
    return Array.from(this.npcs.values())
  }

  /**
   * Check if NPC exists
   * @param {string} id - NPC identifier
   * @returns {boolean} True if NPC exists
   */
  hasNPC(id) {
    return this.npcs.has(id)
  }

  /**
   * Update all NPCs
   * @param {number} delta - Time delta in seconds
   */
  update(delta) {
    for (const npc of this.npcs.values()) {
      try {
        npc.update(delta)
      } catch (error) {
        console.error(`[NPCEngine] Error updating NPC ${npc.id}:`, error)
      }
    }
  }

  /**
   * Destroy engine and all NPCs
   */
  destroy() {
    console.log('[NPCEngine] Destroying...')

    // Despawn all NPCs
    const npcIds = Array.from(this.npcs.keys())
    for (const id of npcIds) {
      this.despawn(id)
    }

    // Clear event bus
    this.eventBus.clear()

    // Clear system factories
    this.systemFactories.clear()

    console.log('[NPCEngine] ✓ Destroyed')
  }

  /**
   * Get engine statistics
   * @returns {Object} Engine stats
   */
  getStats() {
    return {
      npcCount: this.npcs.size,
      registeredSystems: Array.from(this.systemFactories.keys()),
      eventListeners: {
        spawned: this.eventBus.listenerCount('NPC_SPAWNED'),
        destroyed: this.eventBus.listenerCount('NPC_DESTROYED'),
      },
    }
  }
}
