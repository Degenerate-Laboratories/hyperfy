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
import { AttackAnimations, getRandomAnimation } from '../core/extras/playerEmotes.js'

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

    // Start AI update loop (10 times per second)
    this.updateInterval = setInterval(() => this.updateMobs(), 100)

    console.log('[Combat API Bridge] ✅ CombatSystem connected')
    console.log('[Combat API Bridge] ✅ AI update loop started (10 Hz)')
  }

  /**
   * Legacy registerMob for compatibility with old API
   * @param {Object} app - Mob app instance
   * @param {Object} config - Combat configuration
   * @deprecated Use event-driven mob:spawn instead
   */
  registerMob(app, config) {
    if (!app || !app.id) {
      console.warn('[Combat API Bridge] Invalid app for registration')
      return { success: false, error: 'Invalid app' }
    }

    const mobId = app.id

    // Register with CombatSystem
    this.combatSystem.addCombatant(mobId, {
      maxHealth: config.maxHealth || config.health || 100,
      armor: config.armor || 0,
      damage: {
        min: config.damageMin || 1,
        max: config.damageMax || 10
      },
      level: config.level || 1,
      name: config.name || 'Unknown Mob'
    })

    // Store AI state
    this.mobs.set(mobId, {
      app,
      entityId: mobId,
      config: {
        aggroRange: config.aggroRange || 15,
        attackRange: config.attackRange || 3,
        moveSpeed: config.moveSpeed || 2,
        aggressive: config.aggressive !== false,
        attackCooldown: config.attackCooldown || 1500
      },
      state: 'idle',
      targetId: null,
      lastAttackTime: 0,
      homePosition: app.position ? app.position.toArray() : [0, 0, 0]
    })

    console.log(`[Combat API Bridge] ✅ Mob registered: ${config.name} (${mobId})`)

    return {
      success: true,
      mobId: mobId
    }
  }

  /**
   * Legacy attack method for compatibility
   * @param {string} sourceId - Attacker ID
   * @param {string} targetId - Target ID
   * @deprecated Use mob:attack event instead
   */
  attack(sourceId, targetId) {
    // Just emit the event - let the event handler do the work
    this.world.events.emit('mob:attack', {
      sourceId,
      targetId
    })

    return { success: true, sourceId, targetId }
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

  /**
   * AI UPDATE LOOP
   * Runs 10 times per second to update mob behavior
   * - Auto-targets nearest player in aggro range
   * - Moves towards target
   * - Attacks when in range
   */
  updateMobs() {
    for (const [mobId, mobState] of this.mobs.entries()) {
      // Skip dead mobs or non-aggressive mobs
      if (mobState.state === 'dead') continue
      if (!mobState.config.aggressive) continue

      const mobPos = mobState.app.position
      if (!mobPos) continue

      // Find nearest player in range
      let nearestPlayer = null
      let nearestDist = Infinity

      for (const socket of this.world.network.sockets.values()) {
        const player = socket.player
        if (!player || !player.position) continue

        const dist = mobPos.distanceTo(player.position.value)

        // AUTO-TARGET: Find nearest player within aggro range
        if (dist < mobState.config.aggroRange && dist < nearestDist) {
          nearestPlayer = player
          nearestDist = dist
        }
      }

      // Update mob state based on nearest player
      if (nearestPlayer && nearestDist < mobState.config.aggroRange) {
        // AUTO-AGGRO: Transition to aggro/chasing state
        if (mobState.state === 'idle') {
          console.log(`[Combat API] 🎯 ${mobState.config.name} aggros on ${nearestPlayer.data.name} (range: ${nearestDist.toFixed(1)})`)
        }

        mobState.targetId = nearestPlayer.data.id
        mobState.state = 'chasing'

        // Attack if in range
        if (nearestDist < mobState.config.attackRange) {
          const now = Date.now()
          if (now - mobState.lastAttackTime >= mobState.attackCooldown) {
            // Trigger mob attack
            this.world.events.emit('mob:attack', {
              sourceId: mobId,
              targetId: nearestPlayer.data.id
            })

            mobState.lastAttackTime = now
            mobState.state = 'attacking'
          }
        }
      } else {
        // No target in range, return to idle
        if (mobState.state !== 'idle') {
          mobState.state = 'idle'
          mobState.targetId = null
        }
      }
    }
  }

  /**
   * Clean up on destroy
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.mobs.clear()
    console.log('[Combat API Bridge] Shutdown complete')
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

    // CRITICAL: Use data.sourceEntityId instead of data.sourceApp.id
    const mobId = data.sourceEntityId
    const app = world.entities.get(mobId)

    if (!app) {
      console.warn('[Combat API] Mob entity not found:', mobId)
      return
    }

    // Register with CombatSystem (single source of truth)
    world.combat.addCombatant(mobId, {
      maxHealth: data.health || 100,
      armor: data.armor || 0,
      damage: { min: data.damageMin || 5, max: data.damageMax || 15 },
      level: data.level || 1,
      name: data.name
    })

    // Store AI state separately (not combat state)
    bridge.mobs.set(mobId, {
      app,
      entityId: mobId,
      config: {
        aggroRange: data.detectionRange || 15,
        attackRange: data.attackRange || 3,
        moveSpeed: data.moveSpeed || 2,
        aggressive: data.aggressive !== false,
        attackCooldown: data.attackCooldown || 1500
      },
      state: 'idle',
      targetId: null,
      lastAttackTime: 0,
      homePosition: app.position ? app.position.toArray() : [0, 0, 0]
    })

    console.log(`[Combat API] ✅ Registered mob ${data.name} (${mobId}) with CombatSystem`)

    // Send confirmation back to mob
    if (app && app.emit) {
      app.emit('mob:spawn', {
        npcTypeId: mobId,
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

    const { sourceId, targetId } = data

    console.log(`[Combat API] ⚔️ mob:attack: ${sourceId} → ${targetId}`)

    // Let CombatSystem handle damage calculation
    const mobCombatant = world.combat.getCombatant(sourceId)
    if (!mobCombatant) {
      console.warn('[Combat API] Mob not in combat system:', sourceId)
      return
    }

    // Check cooldown
    const mobState = bridge.mobs.get(sourceId)
    if (mobState) {
      const now = Date.now()
      if (now - mobState.lastAttackTime < mobState.config.attackCooldown) {
        return // Attack on cooldown
      }
      mobState.lastAttackTime = now
    }

    // Calculate damage from mob stats
    const min = mobCombatant.damageMin
    const max = mobCombatant.damageMax
    const damage = Math.floor(Math.random() * (max - min + 1)) + min

    // Emit damage event (CombatSystem will handle)
    world.events.emit(CombatEvents.DAMAGE, {
      sourceId,
      targetId,
      amount: damage,
      damageType: 'physical',
      timestamp: Date.now()
    })

    // Play attack emote (v32 pattern)
    const attackEmote = getRandomAnimation(AttackAnimations) + '?l=0'
    const mobEntity = world.entities.get(sourceId)
    if (mobEntity) {
      mobEntity.data.emote = attackEmote
      world.network.send('entityModified', {
        id: sourceId,
        e: attackEmote
      })
    }

    console.log(`[Combat API] ✅ Attack emote sent, damage event emitted: ${damage}`)
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

  // PLAYER:ATTACK - Handle player attacking (from command or network event)
  world.events.on('command', (data) => {
    const { playerId, args } = data
    const [cmd, targetId] = args

    // Only handle playerAttack commands
    if (cmd !== 'playerAttack') return
    if (!targetId) return

    const player = world.entities.get(playerId)
    const target = world.entities.get(targetId)

    if (!player || !target) {
      console.warn('[Combat API] Invalid player attack:', { playerId, targetId })
      return
    }

    console.log(`[Combat API] 🗡️ Player ${player.data.name} attacking ${target.data.name || targetId}`)

    // Play random attack emote on player
    const attackEmote = getRandomAnimation(AttackAnimations) + '?l=0'  // ?l=0 = play once, no loop
    player.data.emote = attackEmote

    // Broadcast emote to all clients
    world.network.send('entityModified', {
      id: playerId,
      e: attackEmote  // 'e' = emote field
    })

    console.log(`[Combat API] 🎭 Player attack emote: ${attackEmote}`)

    // Check if target is a mob (trigger auto-retaliation)
    const mobState = bridge.mobs.get(targetId)
    if (mobState && mobState.state === 'idle') {
      // AUTO-RETALIATION: Mob aggros when attacked
      mobState.state = 'aggro'
      mobState.targetId = playerId
      console.log(`[Combat API] ⚔️ ${target.data.name || 'Mob'} retaliates against ${player.data.name}`)
    }

    // Process player damage to target
    const playerDamage = 10 // TODO: Calculate from player stats
    world.events.emit(CombatEvents.DAMAGE, {
      sourceId: playerId,
      targetId: targetId,
      amount: playerDamage,
      damageType: 'physical',
      timestamp: Date.now()
    })

    // Broadcast damage event
    world.network.send('combatDamage', {
      sourceId: playerId,
      targetId: targetId,
      damage: playerDamage,
      timestamp: Date.now()
    })
  })

  console.log('[Combat API] ✅ Event listeners registered (mob:spawn, mob:attack, mob:death, mob:despawn, player:attack)')

  // =========================================================================
  // LEGACY COMPATIBILITY API (v31 Pattern)
  // =========================================================================

  // Public combat API
  world.combat = {
    // Legacy bridge methods
    registerMob: (app, config) => bridge.registerMob(app, config),
    attack: (attacker, target) => bridge.attack(attacker, target),
    handleDeath: (mobState, killerId) => bridge.handleDeath(mobState, killerId),
    mobs: bridge.mobs,
    getMobState: (id) => bridge.getMobState(id),

    // CombatSystem delegation methods (delegate to the actual CombatSystem instance)
    addCombatant: (entityId, config) => bridge.combatSystem?.addCombatant(entityId, config),
    removeCombatant: (entityId) => bridge.combatSystem?.removeCombatant(entityId),
    getCombatant: (entityId) => bridge.combatSystem?.getCombatant(entityId),
    hasCombatant: (entityId) => bridge.combatSystem?.hasCombatant(entityId)
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