import { SoundModule } from '../../core/systems/SoundManager'

/**
 * Ambient Sound Module
 *
 * Handles environmental ambient sounds:
 * - Background music
 * - Nature sounds (birds, wind, water)
 * - Environmental ambience
 *
 * Auto-registers with SoundManager.
 */
export class AmbientModule extends SoundModule {
  constructor() {
    super()
    this.activeSounds = new Set()
  }

  /**
   * Define all ambient sounds
   */
  getSounds() {
    return {
      // Background music
      music_exploration: {
        url: 'asset://sounds/music/exploration.mp3',
        volume: 0.3,
        spatial: false,
        loop: true,
        category: 'music',
      },
      music_combat: {
        url: 'asset://sounds/music/combat.mp3',
        volume: 0.4,
        spatial: false,
        loop: true,
        category: 'music',
      },

      // Nature sounds
      ambient_birds: {
        url: 'asset://sounds/ambient/birds.wav',
        volume: 0.2,
        spatial: false,
        loop: true,
        category: 'ambient',
      },
      ambient_wind: {
        url: 'asset://sounds/ambient/wind.wav',
        volume: 0.15,
        spatial: false,
        loop: true,
        category: 'ambient',
      },
      ambient_water: {
        url: 'asset://sounds/ambient/water.wav',
        volume: 0.25,
        spatial: true,
        loop: true,
        category: 'ambient',
      },
      ambient_forest: {
        url: 'asset://sounds/ambient/forest.wav',
        volume: 0.2,
        spatial: false,
        loop: true,
        category: 'ambient',
      },
    }
  }

  /**
   * Initialize ambient sound system
   */
  init(world, soundManager) {
    super.init(world, soundManager)
    console.log('[ambient] Ambient sound module initialized')

    // Auto-start ambient sounds based on world settings
    // (You could trigger these based on zones, time of day, etc.)
  }

  /**
   * Start ambient sound
   * @param {string} soundName - Name of ambient sound
   */
  start(soundName) {
    if (this.activeSounds.has(soundName)) {
      console.warn(`[ambient] Sound '${soundName}' already playing`)
      return
    }

    this.soundManager.play(soundName)
    this.activeSounds.add(soundName)
  }

  /**
   * Stop ambient sound
   * @param {string} soundName - Name of ambient sound
   */
  stop(soundName) {
    // TODO: Implement stop functionality in ClientAudio
    this.activeSounds.delete(soundName)
  }

  destroy() {
    this.activeSounds.clear()
  }
}
