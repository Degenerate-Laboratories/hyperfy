import { System } from './System'

/**
 * CombatSystem - Server-Authoritative Combat Logic
 *
 * Handles:
 * - Damage application with health clamping
 * - Healing with max health limits
 * - Death events and combat logging
 * - Server-side combat state ownership
 *
 * Architecture:
 * - Server owns all combat state
 * - Clients are view-only
 * - Events broadcast to all clients
 */
export class CombatSystem extends System {
  async init() {
    // Fail-fast validation
    if (!this.world.entities) {
      throw new Error('[combat] entities system required')
    }
    if (!this.world.events) {
      throw new Error('[combat] events system required')
    }

    // Client-only mode - skip initialization
    if (!this.world.network?.isServer) {
      console.log('[combat] skipping (client-only)')
      return
    }

    // Initialize combat log
    this.combatLog = []

    // Initialize fake rats (Phase 4 - Proof of Concept)
    this.rats = new Set()
    this.nextRatId = 1

    // Combat state tracking
    this.combatStates = new Map() // entityId → {inCombat, targetId, lastCombatTime}

    // Listen for ability activations from clients
    console.log('[CombatSystem] Setting up combat:ability-activate listener')
    this.world.events.on('combat:ability-activate', this.handleAbilityActivate.bind(this))

    console.log('[combat] ✓ initialized (server)')
  }

  /**
   * Fixed update - runs at fixed timestep
   * Ticks all fake rats for AI behavior and handles combat timeout
   */
  fixedUpdate(delta) {
    if (!this.world.network?.isServer) return

    // Combat timeout check (5 seconds of inactivity)
    const now = Date.now()
    this.combatStates.forEach((state, entityId) => {
      if (state.inCombat && now - state.lastCombatTime > 5000) {
        this.exitCombat(entityId)
      }
    })

    // Tick all fake rats
    this.rats.forEach(rat => this.tickFakeRat(rat, delta))
  }

  /**
   * Apply damage to an entity
   * @param {string} targetId - Entity to damage
   * @param {number} amount - Damage amount
   * @param {string} sourceId - Source of damage (optional)
   */
  applyDamage(targetId, amount, sourceId = null) {
    const entity = this.world.entities.get(targetId)
    if (!entity) return

    const oldHealth = entity.data.health || 100
    const maxHealth = entity.data.maxHealth || 100
    const newHealth = Math.max(0, oldHealth - amount)
    entity.data.health = newHealth

    // Log combat event
    this.addToLog({
      type: 'damage',
      targetId,
      sourceId,
      amount,
      health: newHealth,
    })

    // Emit local events
    this.world.events.emit('combat:damage', {
      targetId,
      sourceId,
      amount,
      health: newHealth,
    })

    // Emit entity:health event for UI components
    this.world.events.emit('entity:health', {
      entityId: targetId,
      newHealth: newHealth,
      oldHealth: oldHealth,
      maxHealth: maxHealth,
      change: -amount,
    })

    // Broadcast to all clients
    this.world.network.send('combatDamage', {
      targetId,
      sourceId,
      amount,
      health: newHealth,
      maxHealth,
    })

    // Check death
    if (newHealth === 0 && oldHealth > 0) {
      this.handleDeath(targetId, sourceId)
    }
  }

  /**
   * Apply healing to an entity
   * @param {string} targetId - Entity to heal
   * @param {number} amount - Heal amount
   * @param {string} sourceId - Source of healing (optional)
   */
  applyHeal(targetId, amount, sourceId = null) {
    const entity = this.world.entities.get(targetId)
    if (!entity) return

    const maxHealth = entity.data.maxHealth || 100
    const oldHealth = entity.data.health || 0
    const newHealth = Math.min(maxHealth, oldHealth + amount)
    entity.data.health = newHealth

    // Log combat event
    this.addToLog({
      type: 'heal',
      targetId,
      sourceId,
      amount,
      health: newHealth,
    })

    // Emit local events
    this.world.events.emit('combat:heal', {
      targetId,
      sourceId,
      amount,
      health: newHealth,
    })

    // Emit entity:health event for UI components
    this.world.events.emit('entity:health', {
      entityId: targetId,
      newHealth: newHealth,
      oldHealth: oldHealth,
      maxHealth: maxHealth,
      change: amount,
    })

    // Broadcast to all clients
    this.world.network.send('combatHeal', {
      targetId,
      sourceId,
      amount,
      health: newHealth,
      maxHealth,
    })
  }

  /**
   * Handle entity death
   * @param {string} entityId - Entity that died
   * @param {string} killerId - Entity that killed (optional)
   */
  handleDeath(entityId, killerId = null) {
    const entity = this.world.entities.get(entityId)
    if (!entity) return

    // Log death event
    this.addToLog({
      type: 'death',
      entityId,
      killerId,
    })

    // Emit local event
    this.world.events.emit('combat:death', {
      entityId,
      killerId,
    })

    // Broadcast to all clients
    this.world.network.send('combatDeath', {
      entityId,
      killerId,
    })

    console.log(`[combat] 💀 ${entityId} killed by ${killerId || 'unknown'}`)
  }

  /**
   * Add entry to combat log
   * @param {object} entry - Combat event entry
   */
  addToLog(entry) {
    entry.timestamp = Date.now()
    this.combatLog.push(entry)

    // Keep log size under control (max 100 entries)
    if (this.combatLog.length > 100) {
      this.combatLog.shift()
    }
  }

  /**
   * Get recent combat log entries
   * @param {number} count - Number of entries to retrieve
   * @returns {array} Recent combat log entries
   */
  getCombatLog(count = 20) {
    return this.combatLog.slice(-count)
  }

  /**
   * Handle ability activation from client
   */
  handleAbilityActivate(event) {
    if (!this.world.network?.isServer) return

    const { entityId } = event

    console.log('[combat] Player attacked!')

    // Player takes 10 damage
    this.applyDamage(entityId, 10, 'rat')

    // Find any rat and damage it
    const rat = this.findAnyRat()
    if (rat) {
      this.applyDamage(rat.data.id, 10, entityId)
    }
  }

  /**
   * Enter combat state
   */
  enterCombat(entityId, targetId) {
    const now = Date.now()

    this.combatStates.set(entityId, {
      inCombat: true,
      targetId: targetId,
      lastCombatTime: now,
      enteredAt: now
    })

    // Broadcast combat state to clients
    this.world.network.send('combatStateChanged', {
      entityId,
      inCombat: true,
      targetId,
      timestamp: now
    })

    console.log(`[combat] ${entityId} entered combat with ${targetId}`)
  }

  /**
   * Exit combat state
   */
  exitCombat(entityId) {
    this.combatStates.delete(entityId)

    // Broadcast combat state to clients
    this.world.network.send('combatStateChanged', {
      entityId,
      inCombat: false,
      targetId: null,
      timestamp: Date.now()
    })

    console.log(`[combat] ${entityId} exited combat`)
  }

  /**
   * Find any rat (just get the first one)
   */
  findAnyRat() {
    for (const [id, entity] of this.world.entities.items) {
      if (entity.data.type === 'mob' && entity.data.health > 0) {
        return entity
      }
    }
    return null
  }

  /**
   * Validate ability range (mocked)
   */
  validateAbilityRange(sourceId, targetId, abilityId) {
    // Mock mode: always return true
    // Real implementation would check distance between entities
    return true
  }

  /**
   * Spawn mock rat entity for testing
   */
  spawnMockRat(position = [5, 1, 0]) {
    const ratId = `mock-rat-${Date.now()}`
    const ratData = {
      id: ratId,
      type: 'mob',
      blueprint: 'mob-rat',
      name: 'a sewer rat',
      position: position,
      quaternion: [0, 0, 0, 1],
      health: 50,
      maxHealth: 50
    }

    this.world.entities.add(ratData, true)
    console.log(`[combat] Spawned mock rat: ${ratId} at`, position)
    return ratId
  }

  /**
   * Get combat state for entity
   */
  getCombatState(entityId) {
    return this.combatStates.get(entityId) || null
  }

  /**
   * Check if entity is in combat
   */
  isInCombat(entityId) {
    const state = this.combatStates.get(entityId)
    return state ? state.inCombat : false
  }

  /**
   * Spawn a fake server-side rat for testing
   * @param {array} position - Starting position [x, y, z]
   * @returns {object} Spawned rat object
   */
  spawnFakeRat(position = [0, 1, 0]) {
    const rat = {
      id: `fake-rat-${this.nextRatId++}`,
      position: [...position],
      health: 50,
      maxHealth: 50,
      damage: 10,
      attackRange: 2,
      attackCooldown: 1500,
      lastAttackTime: 0,
      targetId: null,
    }

    this.rats.add(rat)
    console.log(`[combat] 🐀 Spawned fake rat at ${position}`)
    return rat
  }

  /**
   * Despawn a fake rat
   * @param {string} ratId - ID of rat to despawn
   */
  despawnFakeRat(ratId) {
    for (const rat of this.rats) {
      if (rat.id === ratId) {
        this.rats.delete(rat)
        console.log(`[combat] 🐀 Despawned ${ratId}`)
        return
      }
    }
  }

  /**
   * Tick a fake rat's AI behavior
   * @param {object} rat - Rat object to tick
   * @param {number} delta - Time delta
   */
  tickFakeRat(rat, delta) {
    const now = Date.now()

    // Find nearest player
    let nearestPlayer = null
    let nearestDistance = Infinity

    this.world.entities.forEach(entity => {
      if (entity.data.type !== 'player') return

      const dx = entity.data.position[0] - rat.position[0]
      const dy = entity.data.position[1] - rat.position[1]
      const dz = entity.data.position[2] - rat.position[2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPlayer = entity
      }
    })

    if (!nearestPlayer) return

    // Attack if in range and cooldown expired
    if (nearestDistance <= rat.attackRange) {
      if (now - rat.lastAttackTime >= rat.attackCooldown) {
        this.applyDamage(nearestPlayer.data.id, rat.damage, rat.id)
        rat.lastAttackTime = now
        console.log(`[combat] 🐀 ${rat.id} attacks ${nearestPlayer.data.id}`)
      }
    }
  }
}
