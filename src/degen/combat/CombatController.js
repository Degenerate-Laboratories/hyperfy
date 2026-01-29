/**
 * Combat Controller - Client-side Auto-Attack System
 *
 * Handles:
 * - Auto-attack loop (attacks every N seconds while in range)
 * - Target management (engage/disengage)
 * - Range checking (2D distance, ignore Y-axis)
 * - Attack cooldown management
 *
 * Based on v33 CombatController.js
 */

import { System } from '../../core/systems/System.js'
import { CombatEvents } from './events/CombatEvents.js'

export class CombatController extends System {
  constructor(world) {
    super(world)
    this.autoAttackEnabled = false
    this.currentTarget = null
    this.attackInterval = null
    this.attackCooldown = 1500  // 1.5 seconds between attacks
    this.maxAttackRange = 15  // Melee range - rat moves into close range to attack

    console.log('[CombatController] Initialized')
  }

  /**
   * Initialize and listen for target changes
   */
  async init() {
    // Listen for target changes from TargetingSystem
    this.world.events.on(CombatEvents.TARGET_CHANGED, this.onTargetChanged.bind(this))
    console.log('[CombatController] Listening for target changes')
  }

  /**
   * Start - called after all systems are initialized
   */
  start() {
    console.log('[CombatController] Started')
  }

  /**
   * Handle target change event from TargetingSystem
   * @param {Object} event - {entityId, entity}
   */
  onTargetChanged(event) {
    if (!event || !event.entity) {
      // Target cleared
      this.disengageTarget()
      return
    }

    // Auto-engage new target
    console.log('[CombatController] Auto-engaging target from click:', event.entity.data.name || event.entityId)
    this.engageTarget(event.entity)
  }

  /**
   * Engage target and start auto-attacking
   * @param {Object} target - Entity to attack
   */
  engageTarget(target) {
    // Check if player is dead
    const player = this.world.entities.player
    if (!player || player.data.isDead) {
      console.log('[CombatController] Cannot engage target - player is dead')
      return
    }

    if (!target || target.data.isDead) return
    if (this.currentTarget && this.currentTarget.data.id === target.data.id) return

    if (this.currentTarget) this.disengageTarget()

    this.currentTarget = target
    this.autoAttackEnabled = true

    // Sync health properties from nametag to entity.data for combat system
    if (target.nametag) {
      if (target.nametag.health !== undefined) target.data.health = target.nametag.health
      if (target.nametag.maxHealth !== undefined) target.data.maxHealth = target.nametag.maxHealth
      if (target.nametag.label) target.data.name = target.nametag.label
    }

    // Extract name from state if available and not in nametag
    if (!target.data.name && target.data.state?.name) {
      target.data.name = target.data.state.name
    }

    this.world.events.emit('combat:targetChanged', {
      target,
      name: target.data.name || 'Unknown',
      health: target.data.health || target.data.maxHealth || 100,
      maxHealth: target.data.maxHealth || 100
    })
    console.log('[CombatController] Target engaged:', {
      name: target.data.name,
      health: target.data.health,
      maxHealth: target.data.maxHealth,
      distance: 'checking...'
    })

    this.startAttackLoop()
  }

  /**
   * Disengage current target and stop attacking
   */
  disengageTarget() {
    if (this.attackInterval) {
      clearInterval(this.attackInterval)
      this.attackInterval = null
    }

    this.currentTarget = null
    this.autoAttackEnabled = false
    this.world.events.emit('combat:targetChanged', null)
  }

  /**
   * Toggle auto-attack on/off
   */
  toggleAutoAttack() {
    if (this.autoAttackEnabled) {
      this.disengageTarget()
    }
  }

  /**
   * Start the auto-attack loop
   */
  startAttackLoop() {
    if (this.attackInterval) clearInterval(this.attackInterval)

    this.performAttack()  // Attack immediately
    this.attackInterval = setInterval(() => this.performAttack(), this.attackCooldown)
  }

  /**
   * Perform a single attack
   * Checks range and sends attack command to server
   */
  performAttack() {
    const player = this.world.entities.player

    // Check if player is dead
    if (!player || player.data.isDead) {
      console.log('[CombatController] ❌ Cannot attack - player is dead')
      this.disengageTarget()
      return
    }

    if (!this.currentTarget || !this.autoAttackEnabled) {
      console.log('[CombatController] ❌ No target or auto-attack disabled')
      this.disengageTarget()
      return
    }

    if (this.currentTarget.data.isDead) {
      console.log('[CombatController] ❌ Target is dead')
      this.disengageTarget()
      return
    }

    // Get real-time positions (Vector3 objects)
    const playerPos = player.base?.position || player.root?.position
    // Support both App (root) and PlayerRemote (base) position structures
    const targetPos = this.currentTarget.base?.position ||
                      this.currentTarget.root?.position ||
                      this.currentTarget.position

    if (!playerPos || !targetPos) {
      console.log('[CombatController] ❌ Missing position data')
      this.disengageTarget()
      return
    }

    const distance = this.getDistance(playerPos, targetPos)
    console.log(`[CombatController] Distance check: ${distance.toFixed(2)} / ${this.maxAttackRange}`)

    if (distance > this.maxAttackRange) {
      console.log(`[CombatController] ⏸️ Target out of attack range (${distance.toFixed(2)} > ${this.maxAttackRange}) - keeping target, skipping attack`)
      return  // Keep target, just don't attack
    }

    console.log(`[CombatController] ✅ Attacking ${this.currentTarget.data.name || 'Unknown'}`)

    // Send attack command to server
    this.world.network.send('command', {
      args: ['playerAttack', this.currentTarget.data.id]
    })
  }

  /**
   * Calculate 2D distance between two positions (ignore Y-axis)
   * @param {Vector3} pos1 - First position
   * @param {Vector3} pos2 - Second position
   * @returns {number} Distance in units
   */
  getDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity
    const dx = pos2.x - pos1.x  // Vector3 property access
    const dz = pos2.z - pos1.z  // Vector3 property access
    return Math.sqrt(dx * dx + dz * dz)
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    if (this.attackInterval) {
      clearInterval(this.attackInterval)
      this.attackInterval = null
    }

    this.disengageTarget()

    // Clean up event listeners
    this.world.events.off(CombatEvents.TARGET_CHANGED, this.onTargetChanged)

    super.destroy()
  }
}
