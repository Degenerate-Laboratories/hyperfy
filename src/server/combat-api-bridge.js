/**
 * Combat API Bridge - v35 Implementation
 * 
 * Bridges between:
 * - Legacy world.combatManager API (v31 compatibility)  
 * - Modern CombatSystem events (v35 architecture)
 * - Event-driven mob communication (v32+ events)
 *
 * Based on EVENT-SYSTEM-IMPLEMENTATION.md architecture
 */

import { CombatEvents } from '../degen/combat/events/CombatEvents.js'

export class CombatAPIBridge {
  constructor(world) {
    this.world = world
    this.mobs = new Map() // mobId -> mob state
    this.players = new Map() // playerId -> player state
    
    console.log('[Combat API Bridge] Initializing...')
  }

  /**
   * Initialize combat API bridge
   */
  async init() {
    console.log('[Combat API Bridge] Setting up API...')
    
    // Get CombatSystem reference
    this.combatSystem = this.world.combat
    if (!this.combatSystem) {
      console.warn('[Combat API Bridge] CombatSystem not found!')
      return
    }
    
    console.log('[Combat API Bridge] ✅ CombatSystem connected')
  }

  /**
   * Register mob with combat system
   * @param {Object} app - Mob app instance
   * @param {Object} config - Combat configuration
   */
  registerMob(app, config) {
    if (!app || !app.id) {
      console.warn('[Combat API Bridge] Invalid app for registration')
      return { success: false, error: 'Invalid app' }
    }

    const mobId = app.id
    const mobConfig = {
      maxHealth: config.maxHealth || config.health || 100,
      armor: config.armor || 0,
      damage: {
        min: config.damageMin || 1,
        max: config.damageMax || 10
      },
      level: config.level || 1,
      name: config.name || 'Unknown Mob'
    }

    // Register with CombatSystem
    this.combatSystem.addCombatant(mobId, mobConfig)
    
    // Store mob state
    this.mobs.set(mobId, {
      app,
      config: mobConfig,
      lastAttackTime: 0,
      attackCooldown: config.attackCooldown || 1500
    })

    console.log(`[Combat API Bridge] ✅ Mob registered: ${mobConfig.name} (${mobId})`)
    
    return { 
      success: true, 
      mobId: mobId,
      config: mobConfig
    }
  }

  /**
   * Process attack from mob to player
   * @param {string} sourceId - Attacker ID  
   * @param {string} targetId - Target ID
   */
  attack(sourceId, targetId) {
    const mobState = this.mobs.get(sourceId)
    if (!mobState) {
      console.warn(`[Combat API Bridge] Unknown attacker: ${sourceId}`)
      return { success: false, error: 'Unknown attacker' }
    }

    // Check cooldown
    const now = Date.now()
    if (now - mobState.lastAttackTime < mobState.attackCooldown) {
      return { success: false, error: 'Attack on cooldown' }
    }

    // Calculate server-authoritative damage
    const { min, max } = mobState.config.damage
    const damage = Math.floor(Math.random() * (max - min + 1)) + min

    // Apply damage via CombatSystem
    this.world.events.emit(CombatEvents.DAMAGE, {
      sourceId,
      targetId, 
      amount: damage,
      damageType: 'physical',
      timestamp: now
    })

    // Update cooldown
    mobState.lastAttackTime = now

    console.log(`[Combat API Bridge] ⚔️ ${sourceId} → ${targetId}: ${damage} damage`)

    return { 
      success: true, 
      damage, 
      sourceId, 
      targetId,
      timestamp: now
    }
  }

  /**
   * Handle mob death
   * @param {Object} mobState - Mob state
   * @param {string} killerId - Killer ID
   */
  handleDeath(mobState, killerId = null) {
    if (!mobState) return

    const mobId = mobState.app.id

    console.log(`[Combat API Bridge] ☠️ Mob death: ${mobId}`)

    // Remove from combat system
    this.combatSystem.removeCombatant(mobId)
    
    // Clean up mob state
    this.mobs.delete(mobId)

    // Notify mob app of death
    if (mobState.app && mobState.app.emit) {
      mobState.app.emit('mob:death', { 
        mobId, 
        killerId 
      })
    }
  }

  /**
   * Get mob state
   * @param {string} mobId - Mob ID
   */
  getMobState(mobId) {
    return this.mobs.get(mobId)
  }
}

/**
 * Initialize Combat API and inject into world
 * @param {Object} world - World instance
 */
export async function initCombatAPI(world) {
  const bridge = new CombatAPIBridge(world)
  await bridge.init()

  console.log('[Combat API] 🎧 Registering event listeners...')

  // =========================================================================
  // EVENT-DRIVEN COMBAT API (v32+ Pattern)
  // =========================================================================

  // MOB:SPAWN - Register mob with combat system
  world.events.on('mob:spawn', (data) => {
    if (!data || !data.name || data.npcTypeId) return // Skip confirmations

    console.log(`[Combat API] 📨 mob:spawn: ${data.name} from ${data.sourceEntityId}`)

    const result = bridge.registerMob(data.sourceApp, {
      name: data.name,
      level: data.level || 1,
      health: data.health || 100,
      maxHealth: data.maxHealth || data.health || 100,
      damageMin: data.damageMin || 5,
      damageMax: data.damageMax || 15,
      attackCooldown: data.attackCooldown || 1500
    })

    // Send confirmation back to mob
    if (result.success && data.sourceApp) {
      data.sourceApp.emit('mob:spawn', {
        npcTypeId: result.mobId,
        spawnId: data.sourceEntityId
      })
    }
  })

  // MOB:ATTACK - Process attack from mob to player  
  world.events.on('mob:attack', (data) => {
    if (!data || !data.sourceId || !data.targetId) {
      console.warn('[Combat API] Invalid mob:attack data:', data)
      return
    }

    console.log(`[Combat API] ⚔️ mob:attack: ${data.sourceId} → ${data.targetId}`)

    // Execute server-authoritative attack
    const result = bridge.attack(data.sourceId, data.targetId)

    if (result.success) {
      console.log(`[Combat API] ✅ Attack processed: ${result.damage} damage`)
    }
  })

  // MOB:DEATH - Handle mob death
  world.events.on('mob:death', (data) => {
    if (!data || !data.mobId) return

    console.log(`[Combat API] ☠️ mob:death: ${data.mobId}`)

    const mobState = bridge.mobs.get(data.mobId)
    if (mobState) {
      bridge.handleDeath(mobState, data.killerId || null)
    }
  })

  // MOB:DESPAWN - Cleanup mob
  world.events.on('mob:despawn', (data) => {
    if (!data || !data.mobId) return

    console.log(`[Combat API] 🗑️ mob:despawn: ${data.mobId}`)

    if (bridge.mobs.has(data.mobId)) {
      bridge.mobs.delete(data.mobId)
    }
  })

  console.log('[Combat API] ✅ Event listeners registered (mob:spawn, mob:attack, mob:death, mob:despawn)')

  // =========================================================================
  // LEGACY COMPATIBILITY API (v31 Pattern)
  // =========================================================================

  // Public combat API
  world.combat = {
    registerMob: (app, config) => bridge.registerMob(app, config),
    attack: (attacker, target) => bridge.attack(attacker, target),
    handleDeath: (mobState, killerId) => bridge.handleDeath(mobState, killerId),
    mobs: bridge.mobs,
    getMobState: (id) => bridge.getMobState(id)
  }

  // Legacy combatManager API (v31 compatibility)
  world.combatManager = {
    /**
     * Register NPC (v31 compatibility)
     */
    registerNPC(config) {
      if (!config || !config.app) {
        console.warn('[Combat API] Invalid registerNPC config')
        return { success: false }
      }

      return bridge.registerMob(config.app, {
        name: config.name || 'NPC',
        health: config.health || 100,
        maxHealth: config.health || 100,
        damageMin: config.damageMin || 1,
        damageMax: config.damageMax || 10,
        level: config.level || 1
      })
    },

    /**
     * Apply damage (v31 compatibility)
     */
    applyDamage(damageEvent) {
      if (!damageEvent || !damageEvent.sourceId || !damageEvent.targetId) {
        console.warn('[Combat API] Invalid applyDamage event:', damageEvent)
        return { success: false }
      }

      // For legacy API, use provided damage or calculate from mob config
      let damage = damageEvent.damage
      if (!damage) {
        const mobState = bridge.mobs.get(damageEvent.sourceId)
        if (mobState) {
          const { min, max } = mobState.config.damage
          damage = Math.floor(Math.random() * (max - min + 1)) + min
        } else {
          damage = 10 // fallback
        }
      }

      // Apply damage via CombatSystem
      world.events.emit(CombatEvents.DAMAGE, {
        sourceId: damageEvent.sourceId,
        targetId: damageEvent.targetId,
        amount: damage,
        damageType: damageEvent.damageType || 'physical',
        timestamp: Date.now()
      })

      console.log(`[Combat API] [LEGACY] ${damageEvent.sourceId} → ${damageEvent.targetId}: ${damage} damage`)

      return { 
        success: true, 
        damage, 
        sourceId: damageEvent.sourceId,
        targetId: damageEvent.targetId 
      }
    },

    /**
     * Unregister NPC (v31 compatibility)
     */
    unregisterNPC(id) {
      if (bridge.mobs.has(id)) {
        bridge.mobs.delete(id)
        bridge.combatSystem.removeCombatant(id)
        console.log(`[Combat API] [LEGACY] Unregistered NPC: ${id}`)
      }
    }
  }

  console.log('[Combat API] ✅ Legacy compatibility layer ready (world.combatManager)')
  console.log('[Combat API] ✅ Modern API ready (world.combat)')
  console.log('[Combat API] 🎉 Combat bridge initialization complete')

  return bridge
}