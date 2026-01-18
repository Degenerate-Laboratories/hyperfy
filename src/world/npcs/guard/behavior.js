/**
 * Guard Behavior
 * Patrols waypoints and greets nearby players
 *
 * Demonstrates:
 * - Patrol behavior using ActionSystem
 * - Player proximity detection using PerceptionSystem
 * - Chat interactions
 * - Event handling and cleanup
 */

export default {
  lastGreetTime: 0,
  greetedPlayers: new Set(),
  patrolActive: true,
  checkInterval: null,

  /**
   * Called once when NPC spawns
   * Setup initial state, subscribe to events, start behaviors
   */
  async onSpawn({ npc, world, config, events }) {
    console.log(`[Guard] ${npc.getName()} spawned at position:`, npc.getPosition())

    const actions = npc.getSystem('actions')
    const perception = npc.getSystem('perception')

    if (!actions || !perception) {
      console.error('[Guard] Missing required systems')
      return
    }

    // Start patrol behavior
    const waypoints = config.patrolWaypoints || []
    if (waypoints.length > 0) {
      console.log(`[Guard] Starting patrol with ${waypoints.length} waypoints`)

      // Start patrol in background (non-blocking)
      actions.patrol(waypoints, 2, true).catch(error => {
        console.error('[Guard] Patrol error:', error)
      })
    }

    // Setup periodic player checking (every 2 seconds)
    this.checkInterval = setInterval(() => {
      this.checkForPlayers({ npc, world, config })
    }, 2000)

    // Subscribe to custom events (if needed)
    events.on('player_nearby', this.onPlayerNearby.bind(this))

    console.log(`[Guard] ${npc.getName()} initialized successfully`)
  },

  /**
   * Check for nearby players and greet them
   * Called periodically via interval
   */
  checkForPlayers({ npc, world, config }) {
    // Stop checking if NPC is dead
    if (!npc.alive()) {
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
        this.checkInterval = null
      }
      return
    }

    const perception = npc.getSystem('perception')
    const actions = npc.getSystem('actions')

    if (!perception || !actions) return

    const nearestPlayer = perception.getNearestPlayer()

    if (nearestPlayer && nearestPlayer.distance < config.greetDistance) {
      this.greetPlayer(nearestPlayer.id, { npc, world, config, actions })
    }
  },

  /**
   * Greet a specific player (with cooldown)
   */
  async greetPlayer(playerId, { npc, world, config, actions }) {
    const now = Date.now()
    const cooldown = config.greetCooldown || 30000

    // Check if we're on cooldown
    if (now - this.lastGreetTime < cooldown) {
      return
    }

    // Check if we've already greeted this player recently
    if (this.greetedPlayers.has(playerId)) {
      return
    }

    // Select random greeting message
    const messages = config.greetMessages || ['Greetings, traveler.']
    const message = messages[Math.floor(Math.random() * messages.length)]

    try {
      await actions.chat(message)
      console.log(`[Guard] ${npc.getName()} greeted player ${playerId}`)

      this.lastGreetTime = now
      this.greetedPlayers.add(playerId)

      // Clear greeted status after cooldown
      setTimeout(() => {
        this.greetedPlayers.delete(playerId)
      }, cooldown)

    } catch (error) {
      console.error('[Guard] Failed to greet player:', error)
    }
  },

  /**
   * Called when player interacts with NPC
   * Triggered by player clicking/targeting NPC
   */
  async onInteract(player, { npc, world, config }) {
    console.log(`[Guard] ${npc.getName()} interacted by player:`, player.data?.name || player.data?.id)

    const actions = npc.getSystem('actions')
    if (!actions) return

    const playerName = player.data?.name || 'traveler'

    try {
      await actions.chat(`How can I assist you, ${playerName}?`)
      await actions.wait(1500)
      await actions.chat('I patrol these grounds to keep the peace.')
    } catch (error) {
      console.error('[Guard] Interaction error:', error)
    }
  },

  /**
   * Called before NPC despawns
   * Cleanup intervals, remove event listeners
   */
  onDespawn({ npc, world, config, events }) {
    console.log(`[Guard] ${npc.getName()} despawning - cleaning up resources`)

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    // Clear greeted players set
    this.greetedPlayers.clear()

    // Remove event listeners
    events.off('player_nearby', this.onPlayerNearby)

    console.log(`[Guard] ${npc.getName()} cleanup complete`)
  },

  /**
   * Custom event handler for player_nearby events
   */
  onPlayerNearby(data) {
    console.log(`[Guard] Player nearby event:`, data)
    // Additional custom logic can go here
  }
}
