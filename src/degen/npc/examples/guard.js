/**
 * Guard NPC Configuration
 *
 * A simple guard NPC that patrols waypoints and greets nearby players.
 * Demonstrates basic NPC features: patrol, perception, and chat.
 */

export const GuardConfig = {
  id: 'guard-001',
  name: 'Guard Captain',
  spawnPosition: [0, 0, 5],
  quaternion: [0, 0, 0, 1],
  health: 100,
  maxHealth: 100,

  // Enable systems
  systems: {
    actions: {
      enabled: true,
    },
    perception: {
      enabled: true,
      radius: 15,
      detectPlayers: true,
      detectMobs: false,
      updateRate: 0.5, // Update every 500ms
    },
  },
}

/**
 * Advanced Guard with custom behavior
 */
export const AdvancedGuardConfig = {
  id: 'guard-002',
  name: 'Elite Guard',
  spawnPosition: [10, 0, 5],
  quaternion: [0, 0, 0, 1],
  health: 150,
  maxHealth: 150,

  systems: {
    actions: {
      enabled: true,
    },
    perception: {
      enabled: true,
      radius: 20,
      detectPlayers: true,
      detectMobs: true,
      updateRate: 0.2, // More frequent updates
    },
  },
}

/**
 * Example: Setup guard behavior after spawning
 *
 * Usage:
 *   const guard = await world.npcEngine.spawn(GuardConfig)
 *   setupGuardBehavior(guard)
 */
export function setupGuardBehavior(npc) {
  const actions = npc.getSystem('actions')
  const perception = npc.getSystem('perception')

  if (!actions || !perception) {
    console.warn('Guard missing required systems')
    return
  }

  // Define patrol waypoints
  const waypoints = [
    [0, 0, 5],
    [10, 0, 5],
    [10, 0, 15],
    [0, 0, 15],
  ]

  let isPatrolling = true
  let lastGreetTime = 0
  const greetCooldown = 30000 // 30 seconds

  // Start patrol
  actions.patrol(waypoints, 2, true)

  // Check for players periodically
  const behaviorInterval = setInterval(async () => {
    if (!npc.alive()) {
      clearInterval(behaviorInterval)
      return
    }

    // If not patrolling, skip
    if (!isPatrolling) return

    // Check for nearby players
    const nearestPlayer = perception.getNearestPlayer()

    if (nearestPlayer && nearestPlayer.distance < 5) {
      const now = Date.now()

      // Greet player if cooldown has passed
      if (now - lastGreetTime > greetCooldown) {
        await actions.chat('Halt! State your business, traveler.')
        lastGreetTime = now
      }
    }
  }, 2000) // Check every 2 seconds
}
