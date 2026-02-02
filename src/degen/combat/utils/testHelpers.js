/**
 * Combat System Test Helpers
 *
 * Utility functions to test combat UI in browser console
 * Usage: window.CombatTest.XXX()
 */

/**
 * Register test helpers on window object
 * Call this from browser console or add to init
 */
export function registerTestHelpers(world) {
  if (!world) {
    console.error('[CombatTest] No world provided')
    return
  }

  window.CombatTest = {
    /**
     * Test targeting - simulate clicking an entity
     */
    testTarget(entityId) {
      const entity = world.entities.get(entityId)
      if (!entity) {
        console.error(`[CombatTest] Entity ${entityId} not found`)
        console.log('Available entities:', Array.from(world.entities.items.keys()))
        return
      }

      console.log('[CombatTest] Setting target:', entity.data?.name || entityId)
      world.targeting.setTarget(entity)
    },

    /**
     * Test damage - deal damage to an entity
     */
    testDamage(targetId, amount = 25) {
      const player = world.entities.player
      if (!player) {
        console.error('[CombatTest] No player found')
        return
      }

      console.log(`[CombatTest] Dealing ${amount} damage to ${targetId}`)
      world.events.emit('combat:damage', {
        sourceId: player.data?.id || 'player',
        targetId: targetId,
        amount: amount,
        timestamp: Date.now()
      })
    },

    /**
     * Test player damage - deal damage to player
     */
    testPlayerDamage(amount = 25) {
      const player = world.entities.player
      if (!player) {
        console.error('[CombatTest] No player found')
        return
      }

      console.log(`[CombatTest] Dealing ${amount} damage to player`)
      world.events.emit('combat:damage', {
        sourceId: 'test-mob',
        targetId: player.data?.id,
        amount: amount,
        timestamp: Date.now()
      })
    },

    /**
     * Test heal - heal an entity
     */
    testHeal(targetId, amount = 50) {
      const player = world.entities.player
      if (!player) {
        console.error('[CombatTest] No player found')
        return
      }

      console.log(`[CombatTest] Healing ${targetId} for ${amount}`)
      world.events.emit('combat:heal', {
        sourceId: player.data?.id || 'player',
        targetId: targetId,
        amount: amount,
        timestamp: Date.now()
      })
    },

    /**
     * List all entities
     */
    listEntities() {
      console.log('[CombatTest] Available entities:')
      for (const [id, entity] of world.entities.items) {
        console.log(`  - ${id}:`, {
          name: entity.data?.name,
          health: entity.data?.health,
          maxHealth: entity.data?.maxHealth,
          position: entity.position?.value
        })
      }
    },

    /**
     * Get combat log
     */
    getCombatLog() {
      const log = world.combat?.getCombatLog()
      console.log('[CombatTest] Combat log:', log)
      return log
    },

    /**
     * Register test mob with health
     */
    registerTestMob(mobId = 'test-mob', health = 100) {
      console.log(`[CombatTest] Registering test mob: ${mobId}`)
      world.combat.addCombatant(mobId, {
        maxHealth: health,
        armor: 0,
        damage: { min: 10, max: 20 }
      })

      // Emit health changed to trigger UI update
      world.events.emit('entity:health', {
        entityId: mobId,
        oldHealth: health,
        newHealth: health,
        maxHealth: health,
        timestamp: Date.now()
      })

      console.log('[CombatTest] Test mob registered. Stats:', world.combat.getCombatStats(mobId))
    },

    /**
     * Get current target
     */
    getTarget() {
      const target = world.targeting?.getTarget()
      console.log('[CombatTest] Current target:', target?.data?.name || target?.data?.id || 'None')
      return target
    },

    /**
     * Clear current target
     */
    clearTarget() {
      console.log('[CombatTest] Clearing target')
      world.targeting?.clearTarget()
    },

    /**
     * Full test sequence
     */
    runFullTest() {
      console.log('[CombatTest] Running full test sequence...')
      console.log('')

      // List entities
      console.log('1. Listing entities:')
      this.listEntities()
      console.log('')

      // Register test mob
      console.log('2. Registering test mob:')
      this.registerTestMob('test-mob-1', 100)
      console.log('')

      // Set target
      console.log('3. Setting target to test-mob-1:')
      this.testTarget('test-mob-1')
      console.log('')

      // Deal damage
      console.log('4. Dealing 25 damage to test-mob-1:')
      this.testDamage('test-mob-1', 25)
      console.log('')

      // Deal damage to player
      console.log('5. Dealing 15 damage to player:')
      this.testPlayerDamage(15)
      console.log('')

      // Get combat log
      console.log('6. Getting combat log:')
      this.getCombatLog()
      console.log('')

      console.log('[CombatTest] Full test complete! Check UI for:')
      console.log('  - Player health bar (bottom left) should show damage')
      console.log('  - Target health bar (top center) should show test-mob-1')
      console.log('  - Combat log (press L to toggle) should show messages')
      console.log('  - Damage numbers should have floated up')
    },

    /**
     * Show help
     */
    help() {
      console.log('Combat Test Helpers:')
      console.log('')
      console.log('CombatTest.testTarget(entityId) - Set target')
      console.log('CombatTest.testDamage(targetId, amount) - Deal damage')
      console.log('CombatTest.testPlayerDamage(amount) - Damage player')
      console.log('CombatTest.testHeal(targetId, amount) - Heal target')
      console.log('CombatTest.listEntities() - List all entities')
      console.log('CombatTest.getCombatLog() - Show combat log')
      console.log('CombatTest.registerTestMob(id, health) - Add test mob')
      console.log('CombatTest.getTarget() - Show current target')
      console.log('CombatTest.clearTarget() - Clear target')
      console.log('CombatTest.runFullTest() - Run full test sequence')
      console.log('CombatTest.help() - Show this help')
    }
  }

  // Auto-register player as combatant
  const player = world.entities.player
  if (player && player.data?.id) {
    const playerId = player.data.id
    const maxHealth = player.data?.maxHealth || 100
    const currentHealth = player.data?.health ?? maxHealth

    world.combat.addCombatant(playerId, {
      maxHealth,
      armor: 0,
      damage: { min: 5, max: 15 }
    })

    console.log('[CombatTest] Player registered as combatant:', {
      id: playerId,
      health: currentHealth,
      maxHealth
    })
  }

  console.log('[CombatTest] Test helpers registered. Type CombatTest.help() for commands.')
  console.log('[CombatTest] Quick test: CombatTest.runFullTest()')
}
