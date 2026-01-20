/**
 * Character Sound System - Example Implementation
 *
 * This is NOT part of the Hyperfy engine core - it's world-specific content.
 * Copy and modify this file for your game's character sound needs.
 *
 * This example demonstrates:
 * - Using S3/CDN hosted sounds for characters
 * - Registering sounds in world.settings.sounds
 * - Triggering character sounds via network events
 * - Hooking into player movement/actions
 */

// Example S3-hosted character sounds
// Replace these URLs with your actual sound file locations
const CHARACTER_SOUNDS = {
  // Footsteps (different surfaces)
  footstep_grass: 'https://s3.amazonaws.com/degenquest/sounds/footstep_grass.mp3',
  footstep_stone: 'https://s3.amazonaws.com/degenquest/sounds/footstep_stone.mp3',
  footstep_wood: 'https://s3.amazonaws.com/degenquest/sounds/footstep_wood.mp3',
  footstep_water: 'https://s3.amazonaws.com/degenquest/sounds/footstep_water.mp3',

  // Movement
  jump: 'https://s3.amazonaws.com/degenquest/sounds/jump.mp3',
  land: 'https://s3.amazonaws.com/degenquest/sounds/land.mp3',

  // Actions
  pickup: 'https://s3.amazonaws.com/degenquest/sounds/pickup.mp3',
  drop: 'https://s3.amazonaws.com/degenquest/sounds/drop.mp3',

  // Voice
  greeting: 'https://s3.amazonaws.com/degenquest/sounds/greeting.mp3',
  laugh: 'https://s3.amazonaws.com/degenquest/sounds/laugh.mp3',
}

/**
 * Initialize character sounds
 * Call this when the world is ready
 *
 * @param {World} world - Hyperfy world instance
 */
export function initCharacterSounds(world) {
  // Register sounds in world settings
  // This makes them available to resolveSoundUrl() on clients
  if (!world.settings.sounds) {
    world.settings.sounds = {}
  }

  Object.assign(world.settings.sounds, CHARACTER_SOUNDS)

  console.log(`[character-sounds] Registered ${Object.keys(CHARACTER_SOUNDS).length} character sounds`)

  // Example: Hook player movement for footsteps
  setupFootstepSystem(world)

  // Example: Hook player actions
  setupActionSounds(world)
}

/**
 * Setup footstep sound system
 * Plays appropriate footstep sound based on surface type
 */
function setupFootstepSystem(world) {
  // Track last footstep time per player (prevent spam)
  const lastFootstepTime = new Map()
  const FOOTSTEP_INTERVAL = 500 // ms

  world.on('playerMove', player => {
    const now = Date.now()
    const lastTime = lastFootstepTime.get(player.id) || 0

    // Throttle footsteps
    if (now - lastTime < FOOTSTEP_INTERVAL) {
      return
    }

    // Detect surface type at player position
    const surface = detectSurface(world, player.data.position)
    const soundName = `footstep_${surface}`

    // Trigger sound via network (will broadcast to all clients)
    if (world.network && CHARACTER_SOUNDS[soundName]) {
      // Note: This should be triggered server-side
      // The server will broadcast via ServerSound system
      world.network.send('playSound', {
        entityId: player.data.id,
        sound: soundName,
        volume: 0.5,
        spatial: true,
      })
    }

    lastFootstepTime.set(player.id, now)
  })
}

/**
 * Setup action sound system
 * Plays sounds for player actions (jump, land, etc.)
 */
function setupActionSounds(world) {
  // Example: Jump sound
  world.on('playerJump', player => {
    if (world.network && CHARACTER_SOUNDS.jump) {
      world.network.send('playSound', {
        entityId: player.data.id,
        sound: 'jump',
        volume: 0.6,
        spatial: true,
      })
    }
  })

  // Example: Land sound
  world.on('playerLand', player => {
    if (world.network && CHARACTER_SOUNDS.land) {
      world.network.send('playSound', {
        entityId: player.data.id,
        sound: 'land',
        volume: 0.7,
        spatial: true,
      })
    }
  })

  // Example: Pickup sound
  world.on('playerPickup', player => {
    if (world.network && CHARACTER_SOUNDS.pickup) {
      world.network.send('playSound', {
        entityId: player.data.id,
        sound: 'pickup',
        volume: 0.8,
        spatial: false, // Non-spatial for UI feedback
      })
    }
  })
}

/**
 * Detect surface type at given position
 * This is a placeholder - implement your own surface detection logic
 *
 * @param {World} world - World instance
 * @param {Array} position - [x, y, z]
 * @returns {string} Surface type (grass, stone, wood, water)
 */
function detectSurface(world, position) {
  // TODO: Implement actual surface detection
  // You might raycast down from the position and check the material/tag
  // of the object below the player

  // For now, return a default
  return 'grass'
}

/**
 * Example: Manual sound trigger
 * Use this to play character sounds from scripts
 *
 * @param {World} world - World instance
 * @param {string} playerId - Player entity ID
 * @param {string} soundName - Name of sound from CHARACTER_SOUNDS
 * @param {number} volume - Volume (0-1)
 * @param {boolean} spatial - Use spatial audio
 */
export function playCharacterSound(world, playerId, soundName, volume = 1.0, spatial = true) {
  if (!CHARACTER_SOUNDS[soundName]) {
    console.warn(`[character-sounds] Sound '${soundName}' not found`)
    return
  }

  if (world.network) {
    world.network.send('playSound', {
      entityId: playerId,
      sound: soundName,
      volume: volume,
      spatial: spatial,
    })
  }
}

// Export for use in other scripts
export { CHARACTER_SOUNDS }
