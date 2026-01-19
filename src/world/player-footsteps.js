/**
 * Simple Player Footstep System
 *
 * Plays footstep sounds when players move.
 * Uses sounds from world/assets/sounds/
 */

// Footstep sound configuration (using asset:// URLs from world/assets/sounds/)
const FOOTSTEP_SOUNDS = {
  default: 'asset://sounds/footstep_default.wav',
  grass: 'asset://sounds/footstep_grass.wav',
}

const JUMP_SOUND = 'asset://sounds/jump.wav'

/**
 * Initialize player footstep system
 * @param {World} world - World instance (client-side)
 */
export function initPlayerFootsteps(world) {
  // Only run on client
  if (!world.network || world.network.isServer) {
    console.log('[footsteps] Server-side, skipping client footstep init')
    return
  }

  console.log('[footsteps] Initializing player footstep system...')

  // Register footstep sounds in world settings
  if (!world.settings.sounds) {
    world.settings.sounds = {}
  }

  // Add footstep sounds to world settings
  Object.assign(world.settings.sounds, {
    footstep_default: FOOTSTEP_SOUNDS.default,
    footstep_grass: FOOTSTEP_SOUNDS.grass,
    jump: JUMP_SOUND,
  })

  console.log('[footsteps] Registered footstep sounds:', Object.keys(world.settings.sounds))

  // Track footstep timing
  let lastFootstepTime = 0

  // Setup player movement listener via fixedUpdate
  const updateFootsteps = () => {
    const now = Date.now()
    const localPlayer = world.entities?.get(world.network?.id)

    if (!localPlayer || !localPlayer.isPlayer) return

    // Check if player is moving and on the ground
    const isMoving = localPlayer.moving
    const isGrounded = localPlayer.grounded
    const isRunning = localPlayer.running

    // Only play footsteps when moving and grounded
    if (!isMoving || !isGrounded) return

    // Adjust footstep interval based on running/walking
    const footstepInterval = isRunning ? 300 : 450 // ms (faster when running)

    // Throttle footsteps
    if (now - lastFootstepTime < footstepInterval) return

    // Play footstep
    playFootstep(world, localPlayer)
    lastFootstepTime = now
  }

  // Hook into world update loop
  const originalUpdate = world.update?.bind(world)
  if (originalUpdate) {
    world.update = function (...args) {
      updateFootsteps()
      return originalUpdate(...args)
    }
    console.log('[footsteps] Hooked into world.update')
  } else {
    console.warn('[footsteps] Could not hook into world.update')
  }

  console.log('[footsteps] Movement-based footsteps enabled')
}

/**
 * Play footstep sound for player
 * @param {World} world - World instance
 * @param {Entity} player - Player entity
 */
function playFootstep(world, player) {
  // Detect surface type (simplified for now)
  const surfaceType = 'default' // TODO: Implement surface detection

  const soundName = `footstep_${surfaceType}`

  // Direct audio playback on client side
  if (world.audio) {
    const soundUrl = FOOTSTEP_SOUNDS[surfaceType]
    if (soundUrl) {
      const resolvedUrl = world.resolveURL(soundUrl)

      // Create a simple spatial sound at player position
      const position = player.data.position
      world.audio.playSpatialSound(
        player.data.id,
        resolvedUrl,
        0.8, // volume (audible but not overwhelming)
        false, // non-spatial for local player
        { x: position[0], y: position[1], z: position[2] }
      )
    }
  }
}

/**
 * Trigger footstep sound manually (for external use)
 * @param {World} world - World instance
 * @param {string} playerId - Player ID
 * @param {string} surfaceType - Surface type (default, grass, etc.)
 */
export function triggerFootstep(world, playerId, surfaceType = 'default') {
  const player = world.entities?.get(playerId)
  if (!player) {
    console.warn('[footsteps] Player not found:', playerId)
    return
  }

  playFootstep(world, player)
}
