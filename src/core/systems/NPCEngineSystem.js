import { System } from './System'
import { NPCEngine } from '../../degen/npc/core/NPCEngine'
import { HyperfyAdapter } from '../../degen/npc/adapters/HyperfyAdapter'
import { ActionSystem } from '../../degen/npc/systems/ActionSystem'
import { PerceptionSystem } from '../../degen/npc/systems/PerceptionSystem'
import { CommandPlugin } from '../../degen/npc/plugins/CommandPlugin'

/**
 * NPCEngineSystem - World system integration for NPC management
 *
 * Integrates the NPCEngine with Hyperfy's World system.
 * Manages NPC lifecycle, updates, and provides world-level API access.
 *
 * Server-side only - NPCs are server-authoritative entities.
 */
export class NPCEngineSystem extends System {
  constructor(world) {
    super(world)
    this.engine = null
    this.commandPlugin = null
    this.ready = false
  }

  /**
   * Initialize the NPC engine
   * @param {Object} [options={}] - Configuration options
   * @param {Array<Object>} [options.npcs] - Array of NPC configs to spawn
   * @param {boolean} [options.enableCommands=true] - Enable command plugin
   * @param {Object} [options.systemDefaults] - Default system configurations
   */
  async init(options = {}) {
    // Only run on server
    if (!this.world.network.isServer) {
      console.log('[npc-engine] Client-side, skipping initialization')
      return
    }

    console.log('[npc-engine] Initializing...')

    try {
      // Validate dependencies
      if (!this.world.entities) {
        throw new Error('Entities system not initialized')
      }

      // Create adapter and engine
      const adapter = new HyperfyAdapter(this.world)
      this.engine = new NPCEngine(adapter)

      // Register default systems
      this.engine.registerSystem('actions', config => new ActionSystem(config))
      this.engine.registerSystem('perception', config => new PerceptionSystem(config))

      console.log('[npc-engine] ✓ Registered default systems')

      // Initialize command plugin if enabled
      if (options.enableCommands !== false) {
        this.commandPlugin = new CommandPlugin(this.engine)
        this._setupChatIntegration()
        console.log('[npc-engine] ✓ Command plugin enabled')
      }

      // Load NPC configurations if provided
      if (options.npcs && Array.isArray(options.npcs)) {
        console.log(`[npc-engine] Loading ${options.npcs.length} NPC configurations...`)

        for (const npcConfig of options.npcs) {
          try {
            await this.engine.spawn(npcConfig)
          } catch (error) {
            console.error(`[npc-engine] Failed to spawn NPC ${npcConfig.id}:`, error)
          }
        }

        console.log(`[npc-engine] ✓ Spawned ${this.engine.npcs.size} NPCs`)
      }

      // Subscribe to NPC events
      this.engine.eventBus.on('NPC_SPAWNED', data => {
        console.log(`[npc-engine] NPC spawned: ${data.npcId}`)
      })

      this.engine.eventBus.on('NPC_DESTROYED', data => {
        console.log(`[npc-engine] NPC destroyed: ${data.npcId}`)
      })

      this.ready = true
      console.log('[npc-engine] ✓ Initialized')
    } catch (error) {
      console.error('[npc-engine] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Setup chat integration for command processing
   * @private
   */
  _setupChatIntegration() {
    if (!this.commandPlugin) return

    // Hook into world events for chat messages
    // Note: This depends on how chat events are emitted in the world
    // If world.events doesn't exist, we'll need to hook into the chat system directly

    if (this.world.events) {
      this.world.events.on('chat', async data => {
        await this._processChatCommand(data)
      })
    }
  }

  /**
   * Process chat message for commands
   * @private
   * @param {Object} data - Chat data
   * @param {string} data.playerId - Player ID
   * @param {string} data.message - Chat message
   */
  async _processChatCommand(data) {
    if (!this.commandPlugin) return

    const { playerId, message } = data
    if (!playerId || !message) return

    const player = this.world.entities.get(playerId)
    if (!player) return

    const playerPos = player.root?.position || player.data.position

    // Find nearest NPC within command range (5 units)
    let nearestNPC = null
    let nearestDistance = 5

    for (const npc of this.engine.npcs.values()) {
      const npcPos = npc.getPosition()

      const dx = npcPos[0] - playerPos[0]
      const dz = npcPos[2] - playerPos[2]
      const distance = Math.sqrt(dx * dx + dz * dz)

      if (distance < nearestDistance) {
        nearestNPC = npc
        nearestDistance = distance
      }
    }

    // Process command with nearest NPC
    if (nearestNPC) {
      try {
        const handled = await this.commandPlugin.process(nearestNPC.id, playerId, message)
        if (handled) {
          console.log(`[npc-engine] Command processed: "${message}" for NPC ${nearestNPC.id}`)
        }
      } catch (error) {
        console.error('[npc-engine] Command processing error:', error)
      }
    }
  }

  /**
   * Update all NPCs
   */
  fixedUpdate(delta) {
    if (!this.ready || !this.engine) return

    this.engine.update(delta)
  }

  /**
   * Public API: Spawn an NPC
   * @param {Object} config - NPC configuration
   * @returns {Promise<NPC>} Spawned NPC
   */
  async spawn(config) {
    if (!this.engine) {
      throw new Error('[npc-engine] Engine not initialized')
    }

    return this.engine.spawn(config)
  }

  /**
   * Public API: Despawn an NPC
   * @param {string} id - NPC ID
   * @returns {boolean} True if despawned
   */
  despawn(id) {
    if (!this.engine) {
      throw new Error('[npc-engine] Engine not initialized')
    }

    return this.engine.despawn(id)
  }

  /**
   * Public API: Get NPC by ID
   * @param {string} id - NPC ID
   * @returns {NPC|undefined} NPC instance
   */
  getNPC(id) {
    if (!this.engine) return undefined
    return this.engine.getNPC(id)
  }

  /**
   * Public API: Get all NPCs
   * @returns {Array<NPC>} Array of NPCs
   */
  getAllNPCs() {
    if (!this.engine) return []
    return this.engine.getNPCsArray()
  }

  /**
   * Public API: Register custom command
   * @param {string} name - Command name
   * @param {Object} command - Command definition
   * @param {RegExp} command.pattern - Pattern to match
   * @param {Function} command.execute - Execute function(npc, player)
   */
  registerCommand(name, command) {
    if (!this.commandPlugin) {
      throw new Error('[npc-engine] Command plugin not enabled')
    }

    this.commandPlugin.register(name, command)
  }

  /**
   * Public API: Register custom system
   * @param {string} name - System name
   * @param {Function} factory - Factory function
   */
  registerSystem(name, factory) {
    if (!this.engine) {
      throw new Error('[npc-engine] Engine not initialized')
    }

    this.engine.registerSystem(name, factory)
  }

  /**
   * Get engine statistics
   * @returns {Object} Engine stats
   */
  getStats() {
    if (!this.engine) {
      return { npcCount: 0, ready: false }
    }

    return {
      ...this.engine.getStats(),
      ready: this.ready,
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('[npc-engine] Destroying...')

    if (this.engine) {
      this.engine.destroy()
      this.engine = null
    }

    this.commandPlugin = null
    this.ready = false

    console.log('[npc-engine] ✓ Destroyed')
  }
}
