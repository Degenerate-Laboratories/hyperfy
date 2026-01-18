/**
 * ActionSystem - Promise-based action system for NPCs
 *
 * Provides high-level actions that integrate with the degen proxy API.
 * All actions return promises for easy sequencing and composition.
 *
 * Example usage:
 *   const actions = npc.getSystem('actions')
 *   await actions.chat('Hello!')
 *   await actions.moveTo([10, 0, 5], 2)
 *   await actions.chat('I have arrived!')
 */
export class ActionSystem {
  constructor(config = {}) {
    this.config = config
    this.npc = null
    this.actionQueue = []
    this.isExecuting = false
  }

  init() {
    // System initialized
    if (!this.npc) {
      console.error('[ActionSystem] init: npc not set')
      return
    }
  }

  /**
   * Get the mob's world reference
   * @private
   */
  get world() {
    return this.npc?.mob?.world
  }

  /**
   * Get the degen proxy
   * @private
   */
  get degen() {
    return this.npc?.mob?.degen
  }

  /**
   * Move NPC to target position
   * @param {Array<number>|Vector3} target - Target position
   * @param {number} [speed=2] - Movement speed in units/second
   * @param {number} [threshold=0.5] - Distance threshold to consider "arrived"
   * @returns {Promise<void>} Resolves when destination is reached
   */
  async moveTo(target, speed = 2, threshold = 0.5) {
    return new Promise((resolve, reject) => {
      if (!this.degen) {
        reject(new Error('Degen proxy not available'))
        return
      }

      const mob = this.npc.mob
      const targetPos = Array.isArray(target) ? target : target.toArray()

      // Start movement
      this.degen.moveTo(targetPos, speed)

      // Poll for arrival
      const checkInterval = setInterval(() => {
        if (!this.npc.alive()) {
          clearInterval(checkInterval)
          reject(new Error('NPC died during movement'))
          return
        }

        const currentPos = mob.data.position
        const dx = currentPos[0] - targetPos[0]
        const dz = currentPos[2] - targetPos[2]
        const distance = Math.sqrt(dx * dx + dz * dz)

        if (distance < threshold) {
          clearInterval(checkInterval)
          this.degen.idle()
          resolve()
        }
      }, 100) // Check every 100ms
    })
  }

  /**
   * Send chat message
   * @param {string} message - Chat message
   * @param {number} [duration=0] - Optional wait duration in ms
   * @returns {Promise<void>} Resolves after optional duration
   */
  async chat(message, duration = 0) {
    // Try to show chat bubble on NPC entity first (v34 improvement)
    if (this.npc?.mob?.chat) {
      try {
        this.npc.mob.chat(message)
      } catch (error) {
        console.warn('[ActionSystem] Failed to show chat bubble:', error)
      }
    }

    // Also add to world chat
    if (this.world?.chat) {
      this.world.chat.add(
        {
          from: this.npc.getName(),
          fromId: null,
          body: message,
        },
        true
      )
    }

    if (duration > 0) {
      return this.wait(duration)
    }

    return Promise.resolve()
  }

  /**
   * Wait for specified duration
   * @param {number} duration - Duration in milliseconds
   * @returns {Promise<void>} Resolves after duration
   */
  async wait(duration) {
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  /**
   * Follow a player or entity
   * @param {string} targetId - Entity ID to follow
   * @param {number} [speed=2.5] - Movement speed
   * @param {number} [distance=2] - Follow distance
   * @returns {Promise<void>} Resolves immediately (following is continuous)
   */
  async followPlayer(targetId, speed = 2.5, distance = 2) {
    if (!this.degen) {
      return Promise.reject(new Error('Degen proxy not available'))
    }

    this.degen.chase(targetId, speed, distance)
    return Promise.resolve()
  }

  /**
   * Stop following and enter idle state
   * @returns {Promise<void>} Resolves immediately
   */
  async stopFollowing() {
    if (!this.degen) {
      return Promise.reject(new Error('Degen proxy not available'))
    }

    this.degen.idle()
    return Promise.resolve()
  }

  /**
   * Stop movement and return to IDLE state
   * @returns {Promise<void>} Resolves immediately
   */
  async stopMovement() {
    if (!this.degen) {
      return Promise.reject(new Error('Degen proxy not available'))
    }

    this.degen.idle()
    return Promise.resolve()
  }

  /**
   * Trigger emote animation
   * @param {string} emoteName - e.g., 'wave', 'dance', 'sit'
   * @param {number} [duration=3000] - How long the emote lasts in ms
   * @returns {Promise<void>} Resolves after emote completes
   */
  async emote(emoteName, duration = 3000) {
    if (!this.npc?.mob) {
      console.warn('[ActionSystem] emote: mob not available')
      return Promise.resolve()
    }

    // Set emote on entity
    this.npc.mob.modify({ emote: emoteName })

    // Wait for emote duration
    await this.wait(duration)

    // Clear emote
    this.npc.mob.modify({ emote: null })

    return Promise.resolve()
  }

  /**
   * Run away from current position (180 degree turn + flee)
   * This is an improved version that does a proper 180 turn before fleeing
   * @param {number} [distance=15] - How far to run
   * @param {number} [speed=6] - Movement speed
   * @returns {Promise<void>} Resolves when flee completes
   */
  async runAway(distance = 15, speed = 6) {
    if (!this.npc?.mob) {
      return Promise.reject(new Error('Mob not available'))
    }

    const currentPos = this.npc.mob.data.position
    const quaternion = this.npc.mob.data.quaternion || [0, 0, 0, 1]

    // Calculate forward direction from quaternion
    const [qx, qy, qz, qw] = quaternion
    const forwardX = 2 * (qx * qz + qw * qy)
    const forwardZ = 2 * (qy * qz - qw * qx)

    // 180 degree turn = reverse the forward direction
    const fleeX = -forwardX
    const fleeZ = -forwardZ

    // Normalize
    const length = Math.sqrt(fleeX * fleeX + fleeZ * fleeZ) || 1
    const normalizedX = fleeX / length
    const normalizedZ = fleeZ / length

    // Calculate flee position
    const fleePos = [
      currentPos[0] + normalizedX * distance,
      currentPos[1],
      currentPos[2] + normalizedZ * distance,
    ]

    // Move to flee position
    await this.moveTo(fleePos, speed)

    return Promise.resolve()
  }

  /**
   * Patrol between waypoints
   * @param {Array<Array<number>>} waypoints - Array of positions
   * @param {number} [speed=2] - Movement speed
   * @param {boolean} [loop=true] - Whether to loop waypoints
   * @returns {Promise<void>} Resolves when patrol completes (if not looping)
   */
  async patrol(waypoints, speed = 2, loop = true) {
    if (!this.degen) {
      return Promise.reject(new Error('Degen proxy not available'))
    }

    if (!waypoints || waypoints.length === 0) {
      return Promise.reject(new Error('Waypoints array is empty'))
    }

    // Start patrol (handled by degen proxy in aiUpdate)
    this.degen.patrol(waypoints, speed, loop)

    // If looping, return immediately (patrol is continuous)
    if (loop) {
      return Promise.resolve()
    }

    // If not looping, wait until patrol completes
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.npc.alive()) {
          clearInterval(checkInterval)
          reject(new Error('NPC died during patrol'))
          return
        }

        const aiState = this.npc.mob.aiState
        if (aiState.mode === 'idle') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 500)
    })
  }

  /**
   * Flee from a threat
   * @param {string} threatId - Entity ID to flee from
   * @param {number} [speed=4] - Movement speed
   * @param {number} [safeDistance=10] - Safe distance to maintain
   * @returns {Promise<void>} Resolves when safe distance is reached
   */
  async flee(threatId, speed = 4, safeDistance = 10) {
    if (!this.degen) {
      return Promise.reject(new Error('Degen proxy not available'))
    }

    this.degen.flee(threatId, speed, safeDistance)

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.npc.alive()) {
          clearInterval(checkInterval)
          reject(new Error('NPC died while fleeing'))
          return
        }

        const aiState = this.npc.mob.aiState
        if (aiState.mode === 'idle') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 200)
    })
  }

  /**
   * Look at target position
   * @param {Array<number>|Vector3} target - Target position to look at
   * @returns {Promise<void>} Resolves immediately
   */
  async lookAt(target) {
    // For now, rotation is handled by moveTo
    // This could be extended with custom rotation logic
    return Promise.resolve()
  }

  /**
   * Execute a sequence of actions
   * @param {Array<Object>} actions - Array of action objects
   * @param {string} actions[].type - Action method name
   * @param {Array} actions[].args - Action arguments
   * @returns {Promise<void>} Resolves when all actions complete
   *
   * Example:
   *   await actions.executeSequence([
   *     { type: 'chat', args: ['Hello!'] },
   *     { type: 'moveTo', args: [[10, 0, 5], 2] },
   *     { type: 'chat', args: ['I have arrived!'] }
   *   ])
   */
  async executeSequence(actions) {
    for (const action of actions) {
      if (!this[action.type]) {
        console.warn(`[ActionSystem] Unknown action: ${action.type}`)
        continue
      }

      try {
        await this[action.type](...(action.args || []))
      } catch (error) {
        console.error(`[ActionSystem] Error executing ${action.type}:`, error)
        throw error
      }
    }
  }

  /**
   * Find nearest player
   * @param {number} [maxDistance=20] - Maximum search distance
   * @returns {Object|null} { id, distance } or null
   */
  findNearestPlayer(maxDistance = 20) {
    if (!this.degen) return null
    return this.degen.findNearestPlayer(maxDistance)
  }

  /**
   * Get players in range
   * @param {number} [radius=10] - Search radius
   * @returns {Array<Object>} Array of { id, distance }
   */
  getPlayersInRange(radius = 10) {
    if (!this.degen) return []
    return this.degen.getPlayersInRange(radius)
  }

  /**
   * Check if can see player
   * @param {string} playerId - Player ID
   * @param {number} [maxDistance=15] - Maximum sight distance
   * @returns {boolean} True if player is visible
   */
  canSeePlayer(playerId, maxDistance = 15) {
    if (!this.degen) return false
    return this.degen.canSeePlayer(playerId, maxDistance)
  }

  update(delta) {
    // System update (if needed for future enhancements)
  }

  destroy() {
    this.actionQueue = []
  }
}
