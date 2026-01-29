/**
 * CombatSystem - v35 Combat Orchestrator
 *
 * Manages combat state, damage calculations, and combat events
 * Adapted from v34's CombatSystem to work with v35's System architecture
 *
 * Responsibilities:
 * - Track active combatants and their combat components
 * - Handle damage application and death events
 * - Broadcast combat events for UI components
 * - Provide Apps API integration point
 */

import { System } from '../../../core/systems/System.js'
import { CombatEvents, EntityEvents } from '../events/CombatEvents.js'
import CombatComponent from '../core/CombatComponent.js'
import { registerTestHelpers } from '../utils/testHelpers.js'

export class CombatSystem extends System {
  constructor(world) {
    super(world)

    // Component registry: Map<entityId, CombatComponent>
    this.combatants = new Map()

    // Combat log for UI (recent combat events)
    this.combatLog = []
    this.maxLogSize = 100
  }

  /**
   * Initialize system
   */
  async init() {
    console.log('[CombatSystem] Initializing...')

    // Listen for combat events
    this.world.events.on(CombatEvents.DAMAGE, this.handleDamageEvent.bind(this))
    this.world.events.on(CombatEvents.HEAL, this.handleHealEvent.bind(this))

    // Inject Apps API
    this.injectAppsAPI()

    // Register test helpers (browser console)
    registerTestHelpers(this.world)

    console.log('[CombatSystem] Initialized')
  }

  /**
   * Start system
   */
  start() {
    console.log('[CombatSystem] Started')
  }

  /**
   * Inject combat methods into Apps API
   */
  injectAppsAPI() {
    this.world.apps.inject({
      app: {
        // Get current target for this entity
        getTarget() {
          return this.world.targeting?.getTargetForEntity?.(this.entity.data.id)
        },

        // Set target for this entity
        setTarget(entityId) {
          this.world.events.emit(CombatEvents.TARGET, {
            sourceId: this.entity.data.id,
            targetId: entityId,
            timestamp: Date.now()
          })
        },

        // Deal damage to target
        dealDamage(targetId, amount, damageType = 'physical') {
          this.world.events.emit(CombatEvents.DAMAGE, {
            sourceId: this.entity.data.id,
            targetId,
            amount,
            damageType,
            timestamp: Date.now()
          })
        },

        // Heal target
        heal(targetId, amount) {
          this.world.events.emit(CombatEvents.HEAL, {
            sourceId: this.entity.data.id,
            targetId,
            amount,
            timestamp: Date.now()
          })
        },

        // Use ability
        useAbility(abilityId) {
          this.world.events.emit(CombatEvents.ABILITY_ACTIVATE, {
            entityId: this.entity.data.id,
            abilityId,
            timestamp: Date.now()
          })
        }
      }
    })

    console.log('[CombatSystem] Apps API injected')
  }

  /**
   * Register entity as combatant
   * @param {string} entityId - Entity ID
   * @param {Object} config - Combat configuration
   * @param {number} config.maxHealth - Maximum health
   * @param {number} config.armor - Armor value
   * @param {Object} config.damage - Damage range {min, max}
   */
  addCombatant(entityId, config = {}) {
    if (!entityId) {
      console.warn('[CombatSystem] Invalid entity ID')
      return
    }

    if (this.combatants.has(entityId)) {
      console.warn(`[CombatSystem] Entity ${entityId} already registered`)
      return
    }

    const combatComponent = new CombatComponent(config)
    this.combatants.set(entityId, combatComponent)

    console.log(`[CombatSystem] Registered combatant: ${entityId}`, config)
  }

  /**
   * Unregister combatant
   * @param {string} entityId - Entity ID
   */
  removeCombatant(entityId) {
    if (!entityId) return

    this.combatants.delete(entityId)
    console.log(`[CombatSystem] Removed combatant: ${entityId}`)
  }

  /**
   * Get combatant component
   * @param {string} entityId - Entity ID
   * @returns {CombatComponent|null}
   */
  getCombatant(entityId) {
    return this.combatants.get(entityId) || null
  }

  /**
   * Check if entity is registered as combatant
   * @param {string} entityId - Entity ID
   * @returns {boolean}
   */
  hasCombatant(entityId) {
    return this.combatants.has(entityId)
  }

  /**
   * Handle damage event
   * @param {Object} event - Damage event data
   */
  handleDamageEvent(event) {
    const { targetId, amount, sourceId, damageType = 'physical' } = event

    const combatant = this.getCombatant(targetId)
    if (!combatant) {
      console.warn(`[CombatSystem] Target ${targetId} not found`)
      return
    }

    // Apply damage via CombatComponent
    const result = combatant.takeDamage(amount)

    // CRITICAL: Sync health back to entity.data
    const targetEntity = this.world.entities.get(targetId)
    if (targetEntity) {
      targetEntity.data.health = combatant.currentHealth
      targetEntity.data.maxHealth = combatant.maxHealth

      // SERVER ONLY: Broadcast to all clients
      if (this.world.network && this.world.network.send) {
        // Send combatDamage event with full details
        this.world.network.send('combatDamage', {
          sourceId,
          targetId,
          damage: result.damageDealt,
          newHealth: result.newHealth,
          maxHealth: combatant.maxHealth,
          timestamp: event.timestamp || Date.now()
        })

        // Also send entityModified for health bar updates
        this.world.network.send('entityModified', {
          id: targetId,
          health: combatant.currentHealth,
          maxHealth: combatant.maxHealth
        })
      }
    }

    // Get entity names for logging
    const sourceEntity = sourceId ? this.world.entities.get(sourceId) : null
    const targetName = targetEntity?.data?.name || targetId
    const sourceName = sourceEntity?.data?.name || sourceId || 'Unknown'

    // Add to combat log
    this.addToLog({
      type: 'damage',
      sourceName,
      targetName,
      amount: result.damageDealt,
      damageType,
      timestamp: event.timestamp || Date.now()
    })

    // Emit health changed event (for UI)
    this.world.events.emit(EntityEvents.HEALTH_CHANGED, {
      entityId: targetId,
      oldHealth: result.oldHealth,
      newHealth: result.newHealth,
      maxHealth: combatant.maxHealth,
      timestamp: Date.now()
    })

    // Handle death
    if (result.died) {
      this.handleDeath(targetId, sourceId)
    }

    console.log(`[CombatSystem] ⚔️ ${sourceName} → ${targetName}: ${result.damageDealt} damage (${result.newHealth}/${combatant.maxHealth} HP)`)
  }

  /**
   * Handle heal event
   * @param {Object} event - Heal event data
   */
  handleHealEvent(event) {
    const { targetId, amount, sourceId } = event

    const combatant = this.getCombatant(targetId)
    if (!combatant) {
      console.warn(`[CombatSystem] Target ${targetId} not found`)
      return
    }

    // Apply healing
    const result = combatant.heal(amount)

    if (result.success) {
      // Get entity names
      const targetEntity = this.world.entities.get(targetId)
      const sourceEntity = sourceId ? this.world.entities.get(sourceId) : null

      const targetName = targetEntity?.data?.name || targetId
      const sourceName = sourceEntity?.data?.name || sourceId || 'Unknown'

      // Add to combat log
      this.addToLog({
        type: 'heal',
        sourceName,
        targetName,
        amount: result.healAmount,
        timestamp: event.timestamp || Date.now()
      })

      // Emit health changed event
      this.world.events.emit(EntityEvents.HEALTH_CHANGED, {
        entityId: targetId,
        oldHealth: result.oldHealth,
        newHealth: result.newHealth,
        maxHealth: combatant.maxHealth,
        timestamp: Date.now()
      })
    }
  }

  /**
   * Handle entity death
   * @param {string} victimId - Victim entity ID
   * @param {string} killerId - Killer entity ID
   */
  handleDeath(victimId, killerId) {
    const victimEntity = this.world.entities.get(victimId)
    const killerEntity = killerId ? this.world.entities.get(killerId) : null

    const victimName = victimEntity?.data?.name || victimId
    const killerName = killerEntity?.data?.name || killerId || 'Unknown'

    // Emit death event
    this.world.events.emit(CombatEvents.DEATH, {
      victimId,
      killerId,
      timestamp: Date.now()
    })

    // Add to combat log
    this.addToLog({
      type: 'death',
      victimName,
      killerName,
      timestamp: Date.now()
    })

    // Remove from combat system
    this.removeCombatant(victimId)

    // Trigger entity death (if entity supports it)
    if (victimEntity && typeof victimEntity.onDeath === 'function') {
      victimEntity.onDeath(killerId)
    }

    console.log(`[CombatSystem] ☠️ ${victimName} killed by ${killerName}`)
  }

  /**
   * Add entry to combat log
   * @param {Object} entry - Log entry
   */
  addToLog(entry) {
    this.combatLog.push(entry)

    // Keep log size manageable
    if (this.combatLog.length > this.maxLogSize) {
      this.combatLog.shift()
    }
  }

  /**
   * Get recent combat log entries
   * @param {number} count - Number of entries to get
   * @returns {Array} Recent log entries
   */
  getCombatLog(count = 20) {
    return this.combatLog.slice(-count)
  }

  /**
   * Get combat stats for entity
   * @param {string} entityId - Entity ID
   * @returns {Object|null} Combat stats
   */
  getCombatStats(entityId) {
    const combatant = this.getCombatant(entityId)
    return combatant ? combatant.getState() : null
  }

  /**
   * Get target for entity (helper for Apps API)
   * @param {string} entityId - Entity ID
   * @returns {string|null} Target entity ID
   */
  getTargetForEntity(entityId) {
    // This will be implemented by TargetingSystem
    // For now, return null
    return this.world.targeting?.getTarget?.()?.data?.id || null
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.combatants.clear()
    this.combatLog = []
    console.log('[CombatSystem] Destroyed')
  }
}
