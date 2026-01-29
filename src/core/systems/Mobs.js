import { System } from './System'
import { createMobProxy } from '../extras/createMobProxy'

/**
 * Mobs System
 *
 * - Runs on both the server and client
 * - Manages mob-specific runtime hooks and API methods
 * - Integrates with Apps system to extend mob functionality
 * - Provides Degen-branded AI methods
 *
 */
export class Mobs extends System {
  constructor(world) {
    super(world)
    this.mobs = []
    this.ready = false
  }

  init(options) {
    try {
      // Deserialize mobs data
      if (!options.mobs) {
        console.log('[mobs] No mobs data in options, skipping')
        this.ready = true
        return
      }

      this.deserialize(options.mobs)

      // Register mob blueprints in world.blueprints (CRITICAL for entity spawning)
      if (this.world.blueprints) {
        const blueprints = this.getMobBlueprintsUnsafe()
        for (const blueprint of blueprints) {
          this.world.blueprints.add(blueprint)
          console.log(`[mobs] ✓ Registered blueprint in world.blueprints: ${blueprint.id}`)
        }
      } else {
        console.warn('[mobs] Blueprints system not available - mob spawning may fail')
      }

      // Validate Apps system is ready
      if (!this.world.apps) {
        throw new Error('Apps system not initialized')
      }

      // Get mob proxy methods
      const { mobGetters, mobMethods, degenMethods } = createMobProxy()

      // Inject into Apps system with error handling
      try {
        this.world.apps.inject({
          app: {
            // Health system getters
            health: mobGetters.health,
            maxHealth: mobGetters.maxHealth,
            aiState: mobGetters.aiState,

            // Health system methods
            takeDamage: mobMethods.takeDamage,
            heal: mobMethods.heal,

            // Degen-branded AI methods (namespaced)
            degen: {
              get(entity) {
                // Create degen proxy that binds all methods to the entity
                if (!entity._degenProxy) {
                  entity._degenProxy = new Proxy(
                    {},
                    {
                      get: (target, prop) => {
                        if (prop in degenMethods) {
                          return (...args) => degenMethods[prop](entity, ...args)
                        }
                        return undefined
                      },
                    }
                  )
                }
                return entity._degenProxy
              },
            },
          },
        })
      } catch (error) {
        throw new Error(`Failed to inject mob methods: ${error.message}`)
      }

      this.ready = true
      console.log('[mobs] ✓ System ready')

    } catch (error) {
      console.error('[mobs] Initialization failed:', error)
      throw error
    }
  }

  getMobBlueprints() {
    if (!this.ready) {
      console.warn('[mobs] getMobBlueprints called before ready')
      return []
    }

    const blueprints = []
    for (const mobCollection of this.mobs) {
      blueprints.push(...mobCollection.blueprints)
    }
    return blueprints
  }

  deserialize(data) {
    if (!Array.isArray(data)) {
      throw new Error('Mobs data must be an array')
    }

    this.mobs = data

    const blueprintCount = this.getMobBlueprintsUnsafe().length
    if (blueprintCount === 0) {
      throw new Error('No mob blueprints in deserialized data')
    }

    console.log(`[mobs] deserialized ${blueprintCount} blueprint(s)`)

    // Register mob blueprints in world.blueprints (needed for both server and client)
    if (this.world.blueprints) {
      const blueprints = this.getMobBlueprintsUnsafe()
      for (const blueprint of blueprints) {
        this.world.blueprints.add(blueprint)
      }
    }
  }

  getMobBlueprintsUnsafe() {
    const blueprints = []
    for (const mobCollection of this.mobs) {
      blueprints.push(...mobCollection.blueprints)
    }
    return blueprints
  }

  serialize() {
    return this.mobs
  }

  /**
   * Spawn default entities at startup
   * Called after all systems initialized, before world starts
   *
   * @param {Object} config - Configuration object
   * @param {Array} config.defaultSpawns - Array of spawn definitions
   * @returns {Promise<Array>} Array of spawned entities
   */
  async spawnDefaultEntities(config = {}) {
    if (!this.ready) {
      console.warn('[mobs] spawnDefaultEntities called before ready')
      return []
    }

    if (!this.world.entities) {
      console.warn('[mobs] Entities system not available')
      return []
    }

    const defaultSpawns = config.defaultSpawns || []
    if (defaultSpawns.length === 0) {
      console.log('[mobs] No default spawns configured')
      return []
    }

    console.log(`[mobs] Spawning ${defaultSpawns.length} default entities...`)

    const spawnedEntities = []

    for (const spawn of defaultSpawns) {
      try {
        // Find blueprint by ID
        const blueprints = this.getMobBlueprints()
        const blueprint = blueprints.find(bp => bp.id === spawn.blueprintId)

        if (!blueprint) {
          console.warn(`[mobs] Blueprint not found: ${spawn.blueprintId}`)
          continue
        }

        // Spawn entity
        const entity = await this.world.entities.add({
          type: 'app',
          app: blueprint.id,
          position: spawn.position || [0, 0, 0],
          rotation: spawn.rotation || [0, 0, 0, 1]
        })

        if (entity) {
          spawnedEntities.push(entity)
          console.log(`[mobs] ✅ Spawned: ${blueprint.name} at [${spawn.position}]`)
        } else {
          console.warn(`[mobs] Failed to spawn: ${blueprint.name}`)
        }

      } catch (error) {
        console.error(`[mobs] Error spawning entity:`, error)
      }
    }

    console.log(`[mobs] ✅ Spawned ${spawnedEntities.length}/${defaultSpawns.length} default entities`)

    return spawnedEntities
  }

  /**
   * Get blueprint by ID
   * @param {string} blueprintId - Blueprint ID to search for
   * @returns {Object|null} Blueprint object or null if not found
   */
  getBlueprint(blueprintId) {
    if (!this.ready) {
      console.warn('[mobs] getBlueprint called before ready')
      return null
    }

    const blueprints = this.getMobBlueprints()
    return blueprints.find(bp => bp.id === blueprintId) || null
  }

  destroy() {
    this.mobs = []
    this.ready = false
  }
}
