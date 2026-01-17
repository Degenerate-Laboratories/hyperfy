/**
 * CommandPlugin - Player command system for NPCs
 *
 * Allows players to interact with NPCs through chat commands.
 * Commands are matched using regex patterns and execute callbacks.
 *
 * Example usage:
 *   commandPlugin.register('greet', {
 *     pattern: /^(hello|hi|greetings)$/i,
 *     execute: async (npc, player) => {
 *       const actions = npc.getSystem('actions')
 *       await actions.chat(`Hello, ${player.data.name}!`)
 *     }
 *   })
 */
export class CommandPlugin {
  /**
   * Create CommandPlugin
   * @param {NPCEngine} npcEngine - NPC engine instance
   */
  constructor(npcEngine) {
    this.npcEngine = npcEngine
    this.commands = new Map()
    this.registerDefaultCommands()
  }

  /**
   * Register default commands
   * @private
   */
  registerDefaultCommands() {
    // Follow command
    this.register('follow', {
      pattern: /^follow\s*(me)?$/i,
      description: 'Make NPC follow the player',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        if (!actions) {
          console.warn('[CommandPlugin] NPC has no ActionSystem')
          return
        }

        await actions.chat('I will follow you.')
        await actions.followPlayer(player.data.id, 2.5, 2)
      },
    })

    // Stop/Stay command
    this.register('stop', {
      pattern: /^(stop|stay|wait)(\s+here)?$/i,
      description: 'Make NPC stop following',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        if (!actions) return

        await actions.stopFollowing()
        await actions.chat('As you wish.')
      },
    })

    // Greet command
    this.register('greet', {
      pattern: /^(hello|hi|greetings|hey)$/i,
      description: 'Greet the NPC',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        if (!actions) return

        const greetings = [
          `Hello, ${player.data.name}!`,
          `Greetings, ${player.data.name}!`,
          `Well met, ${player.data.name}!`,
          `Good day, ${player.data.name}!`,
        ]

        const greeting = greetings[Math.floor(Math.random() * greetings.length)]
        await actions.chat(greeting)
      },
    })

    // Come here command
    this.register('come', {
      pattern: /^come\s+(here|to\s+me)$/i,
      description: 'Make NPC come to player',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        if (!actions) return

        await actions.chat('Coming!')

        const playerPos = player.root?.position || player.data.position
        const targetPos = Array.isArray(playerPos)
          ? playerPos
          : [playerPos.x, playerPos.y, playerPos.z]

        await actions.moveTo(targetPos, 3)
        await actions.chat('Here I am!')
      },
    })

    // Status command
    this.register('status', {
      pattern: /^(status|health|how\s+are\s+you)$/i,
      description: 'Get NPC status',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        if (!actions) return

        const health = npc.getHealth()
        const maxHealth = npc.getMaxHealth()
        const healthPercent = Math.round((health / maxHealth) * 100)

        let statusMessage
        if (healthPercent > 75) {
          statusMessage = `I'm doing great! Health: ${health}/${maxHealth}`
        } else if (healthPercent > 50) {
          statusMessage = `I'm okay. Health: ${health}/${maxHealth}`
        } else if (healthPercent > 25) {
          statusMessage = `I've been better... Health: ${health}/${maxHealth}`
        } else {
          statusMessage = `I'm badly hurt! Health: ${health}/${maxHealth}`
        }

        await actions.chat(statusMessage)
      },
    })

    console.log('[CommandPlugin] ✓ Registered default commands')
  }

  /**
   * Register a custom command
   * @param {string} name - Command name
   * @param {Object} command - Command definition
   * @param {RegExp} command.pattern - Regex pattern to match
   * @param {string} [command.description] - Command description
   * @param {Function} command.execute - Async function(npc, player)
   */
  register(name, command) {
    if (!command.pattern || !(command.pattern instanceof RegExp)) {
      throw new Error('[CommandPlugin] Command pattern must be a RegExp')
    }

    if (typeof command.execute !== 'function') {
      throw new Error('[CommandPlugin] Command execute must be a function')
    }

    if (this.commands.has(name)) {
      console.warn(`[CommandPlugin] Overwriting command: ${name}`)
    }

    this.commands.set(name, command)
    console.log(`[CommandPlugin] ✓ Registered command: ${name}`)
  }

  /**
   * Unregister a command
   * @param {string} name - Command name
   * @returns {boolean} True if command was removed
   */
  unregister(name) {
    return this.commands.delete(name)
  }

  /**
   * Process a chat message for commands
   * @param {string} npcId - NPC ID
   * @param {string} playerId - Player ID
   * @param {string} message - Chat message
   * @returns {Promise<boolean>} True if command was handled
   */
  async process(npcId, playerId, message) {
    const npc = this.npcEngine.getNPC(npcId)
    if (!npc) {
      console.warn(`[CommandPlugin] NPC not found: ${npcId}`)
      return false
    }

    const player = npc.mob.world.entities.get(playerId)
    if (!player) {
      console.warn(`[CommandPlugin] Player not found: ${playerId}`)
      return false
    }

    // Normalize message
    const normalizedMessage = message.trim()

    // Try to match command
    for (const [name, command] of this.commands) {
      try {
        const match = normalizedMessage.match(command.pattern)
        if (match) {
          console.log(`[CommandPlugin] Executing command: ${name} for NPC ${npcId}`)

          // Execute command
          await command.execute(npc, player, match)

          return true
        }
      } catch (error) {
        console.error(`[CommandPlugin] Error executing command ${name}:`, error)
      }
    }

    return false
  }

  /**
   * Get all registered commands
   * @returns {Map<string, Object>} Map of commands
   */
  getCommands() {
    return new Map(this.commands)
  }

  /**
   * Get command by name
   * @param {string} name - Command name
   * @returns {Object|undefined} Command definition
   */
  getCommand(name) {
    return this.commands.get(name)
  }

  /**
   * Get command list for help
   * @returns {Array<Object>} Array of { name, description, pattern }
   */
  getCommandList() {
    const list = []

    for (const [name, command] of this.commands) {
      list.push({
        name,
        description: command.description || 'No description',
        pattern: command.pattern.toString(),
      })
    }

    return list
  }
}
