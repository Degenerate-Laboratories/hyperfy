/**
 * CommandHandler - Player command system for NPCs
 *
 * Handles player commands to NPCs (follow, stop, wait, come, flee, etc.)
 * Routes commands from players to appropriate NPC behaviors.
 *
 * Ported from v34 with adaptations for v35 architecture.
 */

import { NPCState } from '../core/NPC.js'

export class CommandHandler {
  constructor(config = {}) {
    this.config = config
    this.npc = null

    // Command state
    this.followTarget = null
    this.followDistance = 2.0 // Default follow distance in meters
    this.waitLocation = null
  }

  init() {
    if (!this.npc) {
      console.error('[CommandHandler] init: npc not set')
      return
    }
  }

  /**
   * Get the actions system
   * @private
   */
  get actions() {
    return this.npc.getSystem('actions')
  }

  /**
   * Get the mob's world reference
   * @private
   */
  get world() {
    return this.npc?.mob?.world
  }

  /**
   * Process a command from a player
   * @param {string} command - Command name (e.g., 'follow', 'stop', 'wait')
   * @param {string} playerId - ID of the player issuing the command
   * @param {Object} params - Command parameters
   */
  async handleCommand(command, playerId, params = {}) {
    console.log(`[CommandHandler:${this.npc.getName()}] Received command '${command}' from player ${playerId}`)

    switch (command) {
      case 'follow':
        return await this.handleFollow(playerId, params)

      case 'stop':
      case 'stop-following':
        return await this.handleStopFollowing(playerId, params)

      case 'wait':
        return await this.handleWait(playerId, params)

      case 'wait-here':
        return await this.handleWaitHere(playerId, params)

      case 'come-here':
      case 'come':
        return await this.handleComeHere(playerId, params)

      case 'run-away':
      case 'flee':
      case 'run':
        return await this.handleRunAway(playerId, params)

      default:
        console.warn(`[CommandHandler:${this.npc.getName()}] Unknown command: ${command}`)
        if (this.actions) {
          await this.actions.chat(`I don't understand that command.`)
        }
        return false
    }
  }

  /**
   * Follow command - NPC starts following the player
   */
  async handleFollow(playerId, params) {
    const player = this.world?.entities?.get(playerId)

    if (!player) {
      console.warn(`[CommandHandler:${this.npc.getName()}] Player ${playerId} not found`)
      return false
    }

    // Update NPC state
    this.npc.setState(NPCState.FOLLOWING)
    this.followTarget = playerId
    this.followDistance = params.distance || 2.0

    // Acknowledge command
    if (this.actions) {
      await this.actions.chat(`Following you!`)
    }

    console.log(`[CommandHandler:${this.npc.getName()}] Now following player ${playerId}`)
    return true
  }

  /**
   * Stop following command - NPC stops following
   */
  async handleStopFollowing(playerId, params) {
    if (this.npc.state !== NPCState.FOLLOWING) {
      if (this.actions) {
        await this.actions.chat(`I'm not following anyone.`)
      }
      return false
    }

    // Stop movement
    if (this.actions) {
      await this.actions.stopFollowing()
    }

    // Update NPC state
    this.npc.setState(NPCState.IDLE)
    this.followTarget = null

    // Acknowledge command
    if (this.actions) {
      await this.actions.chat(`Okay, I'll stop following.`)
    }

    console.log(`[CommandHandler:${this.npc.getName()}] Stopped following`)
    return true
  }

  /**
   * Wait command - NPC waits at current location
   */
  async handleWait(playerId, params) {
    const duration = params.duration || null // null = indefinite

    // Update NPC state
    this.npc.setState(NPCState.WAITING)
    this.waitLocation = [...this.npc.getPosition()]

    // Acknowledge command
    if (this.actions) {
      if (duration) {
        await this.actions.chat(`I'll wait here for ${duration / 1000} seconds.`)

        // Auto-resume after duration
        setTimeout(() => {
          if (this.npc.state === NPCState.WAITING) {
            this.npc.setState(NPCState.IDLE)
            if (this.actions) {
              this.actions.chat(`Okay, I'm ready now.`)
            }
          }
        }, duration)
      } else {
        await this.actions.chat(`I'll wait here.`)
      }
    }

    console.log(`[CommandHandler:${this.npc.getName()}] Waiting at`, this.waitLocation)
    return true
  }

  /**
   * Wait here command - Player tells NPC to wait at current location
   */
  async handleWaitHere(playerId, params) {
    return await this.handleWait(playerId, params)
  }

  /**
   * Come here command - NPC moves to player's current location
   */
  async handleComeHere(playerId, params) {
    const player = this.world?.entities?.get(playerId)

    if (!player) {
      console.warn(`[CommandHandler:${this.npc.getName()}] Player ${playerId} not found`)
      return false
    }

    // Get player position
    const playerPos = player.data?.position || [0, 0, 0]

    // Update NPC state
    this.npc.setState(NPCState.MOVING)

    // Acknowledge command
    if (this.actions) {
      await this.actions.chat(`Coming!`)

      // Move to player (speed 3 = walk)
      await this.actions.moveTo(playerPos, 3)

      // Stop movement and return to idle
      await this.actions.stopFollowing()
    }

    this.npc.setState(NPCState.IDLE)

    console.log(`[CommandHandler:${this.npc.getName()}] Moved to player ${playerId}`)
    return true
  }

  /**
   * Run away command - NPC does a 180 and runs away
   */
  async handleRunAway(playerId, params) {
    const distance = params.distance || 15 // Default 15 units
    const speed = params.speed || 6 // Default run speed

    // Update NPC state
    this.npc.setState(NPCState.MOVING)

    // Acknowledge command with panic response
    const panicResponses = [
      `AAAHHH! Running away!`,
      `Flee! Retreat!`,
      `I'm outta here!`,
      `Nope nope nope!`,
      `Time to go!`,
    ]
    const response = panicResponses[Math.floor(Math.random() * panicResponses.length)]

    if (this.actions) {
      await this.actions.chat(response)

      // Execute run away (flee from player)
      await this.actions.flee(playerId, speed, distance)
    }

    // Return to idle
    this.npc.setState(NPCState.IDLE)

    console.log(`[CommandHandler:${this.npc.getName()}] Ran away from player ${playerId}`)
    return true
  }

  /**
   * Update loop - called every tick
   * Handles continuous behaviors like following
   */
  update(delta) {
    // Handle following behavior
    if (this.npc.state === NPCState.FOLLOWING && this.followTarget) {
      this.updateFollowing(delta)
    }
  }

  /**
   * Update following behavior
   * Continuously moves NPC to maintain distance from target
   */
  updateFollowing(delta) {
    const target = this.world?.entities?.get(this.followTarget)

    if (!target) {
      console.warn(
        `[CommandHandler:${this.npc.getName()}] Follow target ${this.followTarget} not found, stopping`
      )
      this.npc.setState(NPCState.IDLE)
      this.followTarget = null
      return
    }

    if (!this.actions) {
      return
    }

    // Get positions
    const npcPos = this.npc.getPosition()
    const targetPos = target.data?.position || [0, 0, 0]

    // Calculate distance
    const dx = targetPos[0] - npcPos[0]
    const dy = targetPos[1] - npcPos[1]
    const dz = targetPos[2] - npcPos[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // If too far, move closer
    if (distance > this.followDistance + 1.0) {
      // Use chase method for continuous following
      this.actions.followPlayer(this.followTarget, 3, this.followDistance)
    }
    // At correct distance - maintain idle following
    else if (distance < this.followDistance - 0.5) {
      // Too close - let natural spacing occur
      this.actions.stopFollowing()
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.followTarget = null
    this.waitLocation = null
  }
}
