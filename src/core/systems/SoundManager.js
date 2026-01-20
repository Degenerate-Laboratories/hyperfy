import { System } from './System'

/**
 * SoundManager - Unified Game Sound System
 *
 * Central sound management system inspired by game engines like Unity/Unreal.
 * Provides:
 * - Declarative sound registration
 * - Event-driven playback
 * - Category-based organization
 * - Auto-discovery of sound modules
 * - Resource pooling and optimization
 *
 * Usage:
 * 1. Define sounds in config files or modules
 * 2. Register sound modules at startup
 * 3. Play sounds via events: world.sounds.play('footstep_grass')
 * 4. No manual imports needed after initial setup
 *
 * Architecture:
 * - SoundManager: Central coordinator
 * - SoundModules: Pluggable sound categories (footsteps, combat, ambient, etc.)
 * - SoundDefinitions: JSON/JS declarations of sounds
 * - Event Bus: Decoupled sound triggering
 */
export class SoundManager extends System {
  constructor(world) {
    super(world)

    // Sound registry: category -> { soundName -> soundDefinition }
    this.registry = new Map()

    // Active sound modules
    this.modules = new Map()

    // Event listeners for cleanup
    this.eventListeners = []

    // Sound playback queue (for deferred sounds before audio unlock)
    this.queuedSounds = []

    // Global sound settings
    this.settings = {
      masterVolume: 1.0,
      categoryVolumes: {
        sfx: 1.0,
        music: 1.0,
        ambient: 0.7,
        ui: 0.8,
        voice: 1.0,
      }
    }
  }

  async init() {
    console.log('[sounds] Initializing SoundManager...')

    // Validate dependencies
    if (!this.world.audio) {
      throw new Error('[sounds] ClientAudio system required')
    }

    // Register core event handlers
    this.setupEventHandlers()

    // Auto-discover and load sound modules
    await this.discoverModules()

    console.log(`[sounds] ✓ SoundManager ready (${this.registry.size} categories)`)
  }

  /**
   * Setup event handlers for sound playback
   */
  setupEventHandlers() {
    // Listen for sound play requests from apps/scripts
    if (this.world.events) {
      this.eventListeners.push(
        this.world.events.on('playSound', this.handlePlaySound)
      )
    }

    // NOTE: Network sound events are handled by ClientAudio.handlePlaySound
    // It already has the correct logic for mob sounds (checks entity blueprints)
    // SoundManager provides the high-level API for game code to trigger sounds
  }

  /**
   * Auto-discover and load sound modules
   * Loads modules from /world/sounds/ directory
   */
  async discoverModules() {
    // Import sound modules dynamically
    // This will be populated by sound modules registering themselves

    // For now, modules must register themselves via:
    // world.sounds.registerModule(name, module)

    // Future: Could use dynamic imports or manifest file
    console.log('[sounds] Sound modules can register via world.sounds.registerModule()')
  }

  /**
   * Register a sound module
   *
   * @param {string} category - Module category (e.g., 'footsteps', 'combat')
   * @param {SoundModule} module - Sound module instance
   *
   * Example:
   * world.sounds.registerModule('footsteps', new FootstepsModule())
   */
  registerModule(category, module) {
    if (this.modules.has(category)) {
      console.warn(`[sounds] Module '${category}' already registered, overwriting`)
    }

    this.modules.set(category, module)

    // Initialize module
    module.init(this.world, this)

    // Register module's sounds
    const sounds = module.getSounds()
    this.registerSounds(category, sounds)

    console.log(`[sounds] ✓ Registered module '${category}' (${Object.keys(sounds).length} sounds)`)
  }

  /**
   * Register multiple sounds under a category
   *
   * @param {string} category - Category name
   * @param {Object} sounds - { soundName: soundDefinition }
   *
   * Sound Definition:
   * {
   *   url: 'asset://sounds/footstep.wav' | 'https://...',
   *   volume: 0.8,
   *   spatial: true,
   *   loop: false,
   *   category: 'sfx', // audio mixer category
   *   variants: ['sound1.wav', 'sound2.wav'], // random selection
   * }
   */
  registerSounds(category, sounds) {
    if (!this.registry.has(category)) {
      this.registry.set(category, new Map())
    }

    const categoryMap = this.registry.get(category)

    for (const [soundName, soundDef] of Object.entries(sounds)) {
      // Validate sound definition
      if (!soundDef.url && !soundDef.variants) {
        console.warn(`[sounds] Sound '${soundName}' missing url or variants`)
        continue
      }

      // Normalize definition
      const normalized = {
        url: soundDef.url || null,
        volume: soundDef.volume ?? 1.0,
        spatial: soundDef.spatial ?? true,
        loop: soundDef.loop ?? false,
        category: soundDef.category || 'sfx',
        variants: soundDef.variants || null,
        ...soundDef,
      }

      categoryMap.set(soundName, normalized)
    }
  }

  /**
   * Play a sound by name
   *
   * @param {string} soundName - Name of sound to play
   * @param {Object} options - Playback options
   *   - entityId: Entity to attach sound to
   *   - position: { x, y, z } for spatial audio
   *   - volume: Override volume (0-1)
   *   - spatial: Override spatial setting
   * @returns {Promise<void>}
   *
   * Example:
   * world.sounds.play('footstep_grass', { entityId: playerId })
   * world.sounds.play('explosion', { position: { x: 10, y: 5, z: 0 } })
   */
  async play(soundName, options = {}) {
    // Find sound definition in registry
    let soundDef = this.findSound(soundName)

    // If not in registry, check if it's a mob sound (stored in entity blueprints)
    if (!soundDef && options.entityId) {
      const entity = this.world.entities?.get(options.entityId)
      if (entity) {
        const mobSoundUrl = this.resolveMobSound(entity, soundName)
        if (mobSoundUrl) {
          // Found in mob blueprint - create temporary definition
          soundDef = {
            url: mobSoundUrl,
            volume: options.volume ?? 1.0,
            spatial: options.spatial ?? true,
            category: 'sfx',
          }
        }
      }
    }

    if (!soundDef) {
      console.warn(`[sounds] Sound '${soundName}' not found in registry or entity blueprints`)
      return
    }

    // Determine sound URL (handle variants)
    let soundUrl = soundDef.url
    if (soundDef.variants && soundDef.variants.length > 0) {
      soundUrl = soundDef.variants[Math.floor(Math.random() * soundDef.variants.length)]
    }

    // Resolve URL (asset:// -> https://)
    const resolvedUrl = this.world.resolveURL(soundUrl)

    // Calculate final volume (definition * category * master)
    const categoryVolume = this.settings.categoryVolumes[soundDef.category] ?? 1.0
    const finalVolume = (options.volume ?? soundDef.volume) * categoryVolume * this.settings.masterVolume

    // Get position for spatial audio
    let position = options.position || { x: 0, y: 0, z: 0 }
    if (options.entityId) {
      const entity = this.world.entities?.get(options.entityId)
      if (entity && entity.data.position) {
        const pos = entity.data.position
        position = { x: pos[0], y: pos[1], z: pos[2] }
      }
    }

    // Play via ClientAudio
    const spatial = options.spatial ?? soundDef.spatial
    await this.world.audio.playSpatialSound(
      options.entityId || 'soundmanager',
      resolvedUrl,
      finalVolume,
      spatial,
      position
    )
  }

  /**
   * Resolve mob sound URL from entity blueprint
   * Checks entity.blueprint.props.soundMap for embedded mob sounds
   *
   * @param {Object} entity - Entity object
   * @param {string} soundName - Name of sound to resolve
   * @returns {string|null} Sound URL or null
   */
  resolveMobSound(entity, soundName) {
    // Check mob blueprint soundMap (embedded sounds with asset:// URLs)
    const soundMap = entity.blueprint?.props?.soundMap
    if (soundMap && soundMap[soundName]) {
      return soundMap[soundName]
    }
    return null
  }

  /**
   * Find a sound definition by name
   * Searches all categories
   *
   * @param {string} soundName - Sound name
   * @returns {Object|null} Sound definition or null
   */
  findSound(soundName) {
    // Search all categories
    for (const [category, sounds] of this.registry.entries()) {
      if (sounds.has(soundName)) {
        return sounds.get(soundName)
      }
    }
    return null
  }

  /**
   * Get all sounds in a category
   *
   * @param {string} category - Category name
   * @returns {Map} Map of sound names to definitions
   */
  getSoundsInCategory(category) {
    return this.registry.get(category) || new Map()
  }

  /**
   * List all registered sounds
   *
   * @returns {Array} Array of { category, soundName, definition }
   */
  listAllSounds() {
    const sounds = []
    for (const [category, categoryMap] of this.registry.entries()) {
      for (const [soundName, definition] of categoryMap.entries()) {
        sounds.push({ category, soundName, definition })
      }
    }
    return sounds
  }

  /**
   * Handle playSound events from apps/scripts
   * @param {Object} data - { sound, volume, spatial, entityId, position }
   */
  handlePlaySound = async (data) => {
    await this.play(data.sound, data)
  }

  /**
   * Set category volume
   * @param {string} category - Category name
   * @param {number} volume - Volume (0-1)
   */
  setCategoryVolume(category, volume) {
    this.settings.categoryVolumes[category] = Math.max(0, Math.min(1, volume))
    console.log(`[sounds] Category '${category}' volume set to ${volume}`)
  }

  /**
   * Set master volume
   * @param {number} volume - Volume (0-1)
   */
  setMasterVolume(volume) {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume))
    console.log(`[sounds] Master volume set to ${volume}`)
  }

  destroy() {
    // Cleanup modules
    for (const [name, module] of this.modules) {
      if (module.destroy) {
        module.destroy()
      }
    }
    this.modules.clear()

    // Cleanup event listeners
    this.eventListeners.forEach(listener => {
      if (listener && typeof listener.off === 'function') {
        listener.off()
      }
    })
    this.eventListeners = []

    // Clear registry
    this.registry.clear()

    console.log('[sounds] SoundManager destroyed')
  }
}

/**
 * Base class for sound modules
 * Extend this to create custom sound categories
 *
 * Example:
 * class FootstepsModule extends SoundModule {
 *   getSounds() {
 *     return {
 *       footstep_grass: { url: 'asset://sounds/footstep_grass.wav', volume: 0.6 },
 *       footstep_stone: { url: 'asset://sounds/footstep_stone.wav', volume: 0.8 },
 *     }
 *   }
 *
 *   init(world, soundManager) {
 *     // Setup event listeners for footsteps
 *     world.events.on('playerMove', () => {
 *       soundManager.play('footstep_grass')
 *     })
 *   }
 * }
 */
export class SoundModule {
  constructor() {
    this.world = null
    this.soundManager = null
  }

  /**
   * Initialize the module
   * @param {World} world - World instance
   * @param {SoundManager} soundManager - SoundManager instance
   */
  init(world, soundManager) {
    this.world = world
    this.soundManager = soundManager
  }

  /**
   * Get sound definitions for this module
   * @returns {Object} Map of sound names to definitions
   */
  getSounds() {
    return {}
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    // Override in subclass
  }
}
