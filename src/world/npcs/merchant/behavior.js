/**
 * Merchant Behavior
 * Demonstrates dialog system and player interaction with shop commands
 *
 * Features:
 * - Interactive greetings
 * - Shop command registration
 * - Inventory display
 * - Dialog sequences
 */

export default {
  /**
   * Called once when NPC spawns
   * Setup shop commands and initial state
   */
  async onSpawn({ npc, world, config, events }) {
    console.log(`[Merchant] ${npc.getName()} is now open for business`)

    // Register shop command with multiple patterns
    const shopCommands = config.shopCommands || ['shop', 'buy', 'sell', 'trade']
    const shopPattern = new RegExp(`^(${shopCommands.join('|')})$`, 'i')

    world.npcEngine.registerCommand('shop', {
      pattern: shopPattern,
      async execute(targetNpc, player) {
        if (targetNpc.id !== npc.id) return // Only respond to our merchant

        const actions = npc.getSystem('actions')
        const inventory = config.shopInventory || []

        if (inventory.length === 0) {
          await actions.chat('Sorry, my shelves are empty right now!')
          return
        }

        // Display shop inventory with formatting
        const items = inventory
          .map(item => `${item.name} - ${item.price}g (${item.description})`)
          .join(' | ')

        await actions.chat('Here is what I have in stock:')
        await actions.wait(1000)
        await actions.chat(items)
        await actions.wait(1500)
        await actions.chat('Say the item name to purchase!')
      },
    })

    // Register individual item purchase commands
    const inventory = config.shopInventory || []
    for (const item of inventory) {
      const itemPattern = new RegExp(`^(buy |purchase )?${item.name}$`, 'i')

      world.npcEngine.registerCommand(`buy_${item.id}`, {
        pattern: itemPattern,
        async execute(targetNpc, player) {
          if (targetNpc.id !== npc.id) return

          const actions = npc.getSystem('actions')
          const playerName = player.data?.name || 'friend'

          await actions.chat(`Excellent choice, ${playerName}!`)
          await actions.wait(1000)
          await actions.chat(`${item.name} for ${item.price} gold.`)
          await actions.wait(1000)
          await actions.chat('Thanks for your business!')

          console.log(`[Merchant] Player ${playerName} purchased ${item.name}`)
        },
      })
    }

    // Register help command
    world.npcEngine.registerCommand('merchant_help', {
      pattern: /^(help|commands|\?)$/i,
      async execute(targetNpc, player) {
        if (targetNpc.id !== npc.id) return

        const actions = npc.getSystem('actions')

        await actions.chat('I respond to: shop, buy, sell, trade')
        await actions.wait(1000)
        await actions.chat('Say an item name to purchase it!')
      },
    })

    console.log(`[Merchant] Registered ${inventory.length + 2} commands`)
  },

  /**
   * Called when player interacts with merchant
   * Shows greeting and instructions
   */
  async onInteract(player, { npc, world, config }) {
    console.log(`[Merchant] ${npc.getName()} interacted by player:`, player.data?.name || player.data?.id)

    const actions = npc.getSystem('actions')
    if (!actions) return

    const playerName = player.data?.name || 'traveler'
    const greetings = config.greetings || ['Welcome to my shop!']
    const greeting = greetings[Math.floor(Math.random() * greetings.length)]

    try {
      // Greeting sequence
      await actions.chat(`${greeting} Welcome, ${playerName}!`)
      await actions.wait(1500)
      await actions.chat('Say "shop" to see my wares.')
      await actions.wait(1000)
      await actions.chat('Or say "help" for available commands.')

      console.log(`[Merchant] Greeted player ${playerName}`)
    } catch (error) {
      console.error('[Merchant] Interaction error:', error)
    }
  },

  /**
   * Called before merchant despawns
   * Cleanup and farewell
   */
  onDespawn({ npc, world, config }) {
    console.log(`[Merchant] ${npc.getName()} is closing shop`)

    // Cleanup is handled by NPCEngine automatically
    // Commands are unregistered when NPC is despawned
  },
}
