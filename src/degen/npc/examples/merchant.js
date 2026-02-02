/**
 * Merchant NPC Configuration
 *
 * A stationary merchant NPC that responds to player interactions.
 * Demonstrates perception, chat, and custom commands.
 */

export const MerchantConfig = {
  id: 'merchant-001',
  name: 'Merchant Bob',
  spawnPosition: [5, 0, 0],
  quaternion: [0, 0, 0, 1],
  health: 80,
  maxHealth: 80,

  systems: {
    actions: {
      enabled: true,
    },
    perception: {
      enabled: true,
      radius: 10,
      detectPlayers: true,
      detectMobs: false,
      updateRate: 0.3,
    },
  },
}

/**
 * Setup merchant behavior
 *
 * Usage:
 *   const merchant = await world.npcEngine.spawn(MerchantConfig)
 *   setupMerchantBehavior(merchant, world.npcEngine)
 */
export function setupMerchantBehavior(npc, npcEngine) {
  const actions = npc.getSystem('actions')
  const perception = npc.getSystem('perception')

  if (!actions || !perception) {
    console.warn('Merchant missing required systems')
    return
  }

  // Register custom commands via NPCEngineSystem
  if (npcEngine) {
    // Trade command
    npcEngine.commandPlugin?.register('trade', {
      pattern: /^(trade|shop|buy|sell)$/i,
      description: 'Open trade window with merchant',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        await actions.chat("Welcome to my shop! I have the finest goods in the realm!")
        // In a real implementation, this would open a trade UI
      },
    })

    // Wares command
    npcEngine.commandPlugin?.register('wares', {
      pattern: /^(wares|inventory|stock)$/i,
      description: 'Show merchant inventory',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')
        await actions.chat("I have potions, weapons, and armor. Say 'trade' to see more!")
      },
    })
  }

  // Greet nearby players
  let lastGreetTime = 0
  const greetCooldown = 20000 // 20 seconds

  const behaviorInterval = setInterval(async () => {
    if (!npc.alive()) {
      clearInterval(behaviorInterval)
      return
    }

    const nearestPlayer = perception.getNearestPlayer()

    if (nearestPlayer && nearestPlayer.distance < 5) {
      const now = Date.now()

      if (now - lastGreetTime > greetCooldown) {
        const greetings = [
          'Welcome, friend! Looking to trade?',
          'Greetings, traveler! I have wares if you have coin.',
          "Ah, a customer! Let me know if you'd like to see my goods.",
        ]

        const greeting = greetings[Math.floor(Math.random() * greetings.length)]
        await actions.chat(greeting)
        lastGreetTime = now
      }
    }
  }, 3000) // Check every 3 seconds
}
