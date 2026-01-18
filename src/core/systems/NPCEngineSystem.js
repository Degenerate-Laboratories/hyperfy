import { System } from './System'
import { NPCEngine } from '../../degen/npc/core/NPCEngine'
import { NPCRegistry } from '../../degen/npc/core/NPCRegistry'
import { HyperfyAdapter } from '../../degen/npc/adapters/HyperfyAdapter'
import { ActionSystem } from '../../degen/npc/systems/ActionSystem'
import { PerceptionSystem } from '../../degen/npc/systems/PerceptionSystem'
import { CommandHandler } from '../../degen/npc/systems/CommandHandler'
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
    this.registry = new NPCRegistry()
    this.commandPlugin = null
    this.behaviorModules = new Map()  // Store behavior modules
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
    console.log('[npc-engine] Initializing...')

    // Server-side initialization
    if (this.world.network.isServer) {
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
        this.engine.registerSystem('commands', config => new CommandHandler(config))

        console.log('[npc-engine] ✓ Registered default systems (actions, perception, commands)')

        // Load NPC registry if provided
        if (options.npcCharacters && Array.isArray(options.npcCharacters)) {
          this.registry.load({ characters: options.npcCharacters })
          console.log(`[npc-engine] ✓ Loaded NPC registry (${this.registry.size()} characters)`)
        }

        // Store behavior modules from server loader
        if (options.npcBehaviors && options.npcBehaviors instanceof Map) {
          this.behaviorModules = options.npcBehaviors
          console.log(`[npc-engine] ✓ Loaded ${this.behaviorModules.size} behavior module(s)`)
        }

        // Setup registry sync to clients on connection
        this.world.network.on('playerJoined', playerId => {
          this.syncRegistryToClient(playerId)
        })
        console.log('[npc-engine] ✓ Registry sync enabled')

        // Sync registry to all already-connected players
        if (this.world.entities?.players) {
          let syncedCount = 0
          this.world.entities.players.forEach(player => {
            if (player.data?.id) {
              this.syncRegistryToClient(player.data.id)
              syncedCount++
            }
          })
          if (syncedCount > 0) {
            console.log(`[npc-engine] ✓ Synced registry to ${syncedCount} existing player(s)`)
          }
        }

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
        // Call onDespawn lifecycle hook if behavior exists
        const npc = data.npc
        if (npc?._behaviorModule?.onDespawn && npc?._behaviorContext) {
          try {
            npc._behaviorModule.onDespawn(npc._behaviorContext)
            console.log(`[npc-engine] ✓ Behavior onDespawn executed: ${data.npcId}`)
          } catch (error) {
            console.error(`[npc-engine] onDespawn failed for ${data.npcId}:`, error)
          }
        }
      })

        this.ready = true
        console.log('[npc-engine] ✓ Server initialized')
      } catch (error) {
        console.error('[npc-engine] Initialization failed:', error)
        throw error
      }
    } else {
      // Client-side initialization
      console.log('[npc-engine] Client-side initialization')

      // Wait for registry sync from server
      this.world.network.on('npc_registry_sync', data => {
        this.registry.load({ characters: data.characters })
        this.registry.ready = true
        console.log(`[npc-engine] Client registry synced: ${data.characters.length} character(s)`)
      })
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
   * Public API: Spawn NPC from registry
   * @param {string} characterId - Character ID from registry
   * @param {Object} [overrides={}] - Optional spawn overrides
   * @returns {Promise<NPC>} Spawned NPC
   */
  async spawnFromRegistry(characterId, overrides = {}) {
    if (!this.registry.ready) {
      throw new Error('[npc-engine] NPC registry not loaded')
    }

    const character = this.registry.get(characterId)
    if (!character) {
      throw new Error(`[npc-engine] Character not found: ${characterId}`)
    }

    // Create spawn config with character data
    const config = this.registry.createSpawnConfig(characterId, overrides)

    // Add character data for adapter to use (avatar, stats, etc.)
    config.characterData = character
    config.avatar = character.model

    const npc = await this.spawn(config)

    // Execute behavior if configured and autoStart enabled
    if (character?.behavior?.autoStart) {
      await this.executeBehavior(npc, characterId)
    }

    return npc
  }

  /**
   * Public API: Get all characters from registry
   * @returns {Array<Object>} Array of character definitions
   */
  getRegistryCharacters() {
    return this.registry.getAll()
  }

  /**
   * Public API: Get character from registry
   * @param {string} characterId - Character ID
   * @returns {Object|null} Character definition
   */
  getRegistryCharacter(characterId) {
    return this.registry.get(characterId)
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
   * Execute behavior script for an NPC
   * @param {NPC} npc - NPC instance
   * @param {string} characterId - Character ID
   * @returns {Promise<void>}
   */
  async executeBehavior(npc, characterId) {
    const behaviorModule = this.behaviorModules?.get(characterId)
    if (!behaviorModule) {
      console.warn(`[npc-engine] No behavior found for ${characterId}`)
      return
    }

    const character = this.registry.get(characterId)
    const context = {
      npc,
      world: this.world,
      config: character.behavior?.config || {},
      events: this.engine.eventBus,
    }

    try {
      // Call onSpawn lifecycle hook
      if (behaviorModule.onSpawn) {
        await behaviorModule.onSpawn(context)
        console.log(`[npc-engine] ✓ Behavior onSpawn executed: ${characterId}`)
      }

      // Register onUpdate hook if defined
      if (behaviorModule.onUpdate) {
        npc._behaviorUpdate = delta => {
          behaviorModule.onUpdate(delta, context)
        }
      }

      // Register onInteract hook if defined
      if (behaviorModule.onInteract) {
        npc._behaviorInteract = async player => {
          await behaviorModule.onInteract(player, context)
        }
      }

      // Store behavior for cleanup
      npc._behaviorModule = behaviorModule
      npc._behaviorContext = context

      console.log(`[npc-engine] ✓ Behavior initialized: ${characterId}`)
    } catch (error) {
      console.error(`[npc-engine] Behavior execution failed for ${characterId}:`, error)
    }
  }

  /**
   * Serialize NPC registry for client snapshot
   * @returns {Object} Serialized registry data
   */
  serializeRegistry() {
    if (!this.registry.ready) {
      throw new Error('[npcEngine] Cannot serialize registry - not ready')
    }

    return {
      characters: this.registry.getAll().map(char => ({
        id: char.id,
        name: char.name,
        title: char.title,
        level: char.level,
        class: char.class,
        faction: char.faction,
        lore: char.lore,
        stats: char.stats,
        model: char.model,
      })),
      ready: this.registry.ready,
    }
  }

  /**
   * Deserialize NPC registry from server snapshot (CLIENT-SIDE)
   * @param {Object} data - Registry data from snapshot
   */
  deserializeRegistry(data) {
    if (!data || !data.characters) {
      throw new Error('[npcEngine] Invalid registry data in snapshot')
    }

    if (!Array.isArray(data.characters)) {
      throw new Error('[npcEngine] Registry characters must be an array')
    }

    if (data.characters.length === 0) {
      throw new Error('[npcEngine] No NPC characters in snapshot')
    }

    // Load registry data (will throw if invalid)
    this.registry.load({ characters: data.characters })

    if (!this.registry.ready) {
      throw new Error('[npcEngine] Registry failed to initialize')
    }

    console.log(`[npcEngine] ✓ Client registry loaded (${data.characters.length} characters)`)
  }

  /**
   * Sync NPC registry to a specific client
   * @param {string} playerId - Player ID to sync to
   */
  syncRegistryToClient(playerId) {
    if (!this.world.network.isServer) return

    const registryData = {
      characters: this.registry.getAll().map(char => ({
        // Send metadata only (not behavior scripts)
        id: char.id,
        name: char.name,
        title: char.title,
        level: char.level,
        class: char.class,
        faction: char.faction,
        lore: char.lore,
        stats: char.stats,
      })),
    }

    this.world.network.send('npc_registry_sync', registryData, playerId)
    console.log(`[npc-engine] Registry synced to player: ${playerId}`)
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
