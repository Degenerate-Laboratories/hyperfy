import { SoundModule } from '../../core/systems/SoundManager'

/**
 * Footsteps Sound Module
 *
 * Handles all player/character footstep sounds.
 * Auto-registers with SoundManager - no manual initialization needed.
 *
 * Features:
 * - Surface-based footstep sounds (grass, stone, wood, water, etc.)
 * - Speed-based footstep timing (walk vs run)
 * - Jump/land sounds
 * - Ground detection
 */
export class FootstepsModule extends SoundModule {
  constructor() {
    super()
    this.lastFootstepTime = new Map() // playerId -> timestamp
    this.footstepIntervals = {
      walk: 450,
      run: 300,
    }
  }

  /**
   * Define all footstep sounds
   * Returns a map of sound names to definitions
   */
  getSounds() {
    return {
      // Footsteps by surface type
      footstep_grass: {
        url: 'asset://sounds/footstep_grass.wav',
        volume: 0.6,
        spatial: true,
        category: 'sfx',
      },
      footstep_stone: {
        url: 'asset://sounds/footstep_stone.wav',
        volume: 0.8,
        spatial: true,
        category: 'sfx',
      },
      footstep_wood: {
        url: 'asset://sounds/footstep_wood.wav',
        volume: 0.7,
        spatial: true,
        category: 'sfx',
      },
      footstep_water: {
        url: 'asset://sounds/footstep_water.wav',
        volume: 0.5,
        spatial: true,
        category: 'sfx',
      },
      footstep_default: {
        url: 'asset://sounds/footstep_default.wav',
        volume: 0.7,
        spatial: true,
        category: 'sfx',
      },

      // Jump/land sounds
      jump: {
        url: 'asset://sounds/jump.wav',
        volume: 0.6,
        spatial: true,
        category: 'sfx',
      },
      land: {
        url: 'asset://sounds/land.wav',
        volume: 0.7,
        spatial: true,
        category: 'sfx',
      },
    }
  }

  /**
   * Initialize footstep system
   * Sets up event listeners for player movement
   */
  init(world, soundManager) {
    super.init(world, soundManager)

    // Only run on client
    if (!world.network || world.network.isServer) {
      console.log('[footsteps] Server-side, skipping client footstep init')
      return
    }

    console.log('[footsteps] Initializing footstep module...')

    // Hook into world update loop for movement-based footsteps
    this.setupMovementListener()

    console.log('[footsteps] ✓ Footstep module ready')
  }

  /**
   * Setup movement listener for footstep playback
   */
  setupMovementListener() {
    // Hook into world update loop
    const originalUpdate = this.world.update?.bind(this.world)
    if (originalUpdate) {
      this.world.update = (...args) => {
        this.updateFootsteps()
        return originalUpdate(...args)
      }
    }
  }

  /**
   * Update footsteps based on player movement
   * Called every frame via world update
   */
  updateFootsteps() {
    const now = Date.now()
    const localPlayer = this.world.entities?.get(this.world.network?.id)

    if (!localPlayer || !localPlayer.isPlayer) return

    // Check if player is moving and on the ground
    const isMoving = localPlayer.moving
    const isGrounded = localPlayer.grounded
    const isRunning = localPlayer.running

    // Only play footsteps when moving and grounded
    if (!isMoving || !isGrounded) return

    // Get player ID
    const playerId = localPlayer.data.id

    // Adjust footstep interval based on running/walking
    const footstepInterval = isRunning
      ? this.footstepIntervals.run
      : this.footstepIntervals.walk

    // Get last footstep time for this player
    const lastTime = this.lastFootstepTime.get(playerId) || 0

    // Throttle footsteps
    if (now - lastTime < footstepInterval) return

    // Play footstep
    this.playFootstep(localPlayer)

    // Update last footstep time
    this.lastFootstepTime.set(playerId, now)
  }

  /**
   * Play footstep sound for a player
   * @param {Entity} player - Player entity
   */
  playFootstep(player) {
    // Detect surface type at player position
    const surfaceType = this.detectSurface(player.data.position)

    // Construct sound name
    const soundName = `footstep_${surfaceType}`

    // Play via SoundManager
    this.soundManager.play(soundName, {
      entityId: player.data.id,
      spatial: false, // Non-spatial for local player
    })
  }

  /**
   * Detect surface type at position
   * @param {Array} position - [x, y, z]
   * @returns {string} Surface type (grass, stone, wood, water, default)
   */
  detectSurface(position) {
    // TODO: Implement actual surface detection
    // Could raycast down and check material/tag of ground
    // For now, return default
    return 'default'
  }

  /**
   * Trigger jump sound for a player
   * @param {string} playerId - Player ID
   */
  triggerJump(playerId) {
    this.soundManager.play('jump', {
      entityId: playerId,
    })
  }

  /**
   * Trigger land sound for a player
   * @param {string} playerId - Player ID
   */
  triggerLand(playerId) {
    this.soundManager.play('land', {
      entityId: playerId,
    })
  }

  destroy() {
    // Cleanup
    this.lastFootstepTime.clear()
  }
}
