/**
 * TargetingComponent
 *
 * Standalone targeting logic extracted from v33 combat-api-bridge.js
 * Pure logic component with no framework coupling.
 *
 * Reference: DegenQuest-v33/projects/playground/hyperfy/src/server/combat-api-bridge.js
 * Lines 1046-1128: Target selection, validation, and range checking
 *
 * Responsibilities:
 * - Track current target entity
 * - Validate target is alive and valid
 * - Check if target is in range (attack or aggro)
 * - Calculate distances between positions
 * - Update target based on proximity and validity
 */

class TargetingComponent {
  /**
   * Create targeting component
   * @param {Object} config - Configuration
   * @param {number} config.attackRange - Maximum attack distance
   * @param {number} config.aggroRange - Maximum aggro/detection distance
   */
  constructor(config = {}) {
    this.attackRange = config.attackRange || 3.0
    this.aggroRange = config.aggroRange || 10.0
    this.currentTarget = null
  }

  /**
   * Set current target
   * @param {string|null} entityId - Target entity ID
   */
  setTarget(entityId) {
    if (entityId === null || entityId === undefined) {
      this.currentTarget = null
      return
    }

    this.currentTarget = entityId
  }

  /**
   * Clear current target
   */
  clearTarget() {
    this.currentTarget = null
  }

  /**
   * Check if currently has a target
   * @returns {boolean} True if has target
   */
  hasTarget() {
    return this.currentTarget !== null && this.currentTarget !== undefined
  }

  /**
   * Validate target entity is alive and valid
   *
   * Extracted from v33 lines 1047-1050:
   * - nearestPlayer.data.health > 0
   * - !nearestPlayer.data.isDead
   *
   * @param {Object|null} targetEntity - Target entity data
   * @param {number} targetEntity.health - Target health
   * @param {boolean} targetEntity.isDead - Target dead state
   * @returns {boolean} True if target is valid
   */
  isTargetValid(targetEntity) {
    if (!targetEntity) {
      return false
    }

    // Check health > 0 (v33 line 1048)
    if (targetEntity.health === undefined || targetEntity.health <= 0) {
      return false
    }

    // Check not dead (v33 line 1049)
    if (targetEntity.isDead === true) {
      return false
    }

    return true
  }

  /**
   * Check if target is in range
   *
   * Extracted from v33 lines 1024, 1050, 1105:
   * - dist < mobState.config.aggroRange (aggro range check)
   * - currentDist < mobState.config.attackRange (attack range check)
   *
   * @param {Object} attackerPos - Attacker position {x, y, z}
   * @param {Object} targetPos - Target position {x, y, z}
   * @param {string} rangeType - Range type: 'attack' or 'aggro'
   * @returns {boolean} True if in range
   */
  isInRange(attackerPos, targetPos, rangeType = 'attack') {
    const distance = this.getDistance(attackerPos, targetPos)
    const range = rangeType === 'attack' ? this.attackRange : this.aggroRange

    return distance <= range
  }

  /**
   * Calculate 3D distance between two positions
   *
   * Extracted from v33 line 1022:
   * - const dist = mobPos.distanceTo(player.position.value)
   *
   * @param {Object} pos1 - First position {x, y, z}
   * @param {Object} pos2 - Second position {x, y, z}
   * @returns {number} Distance
   */
  getDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    const dz = pos2.z - pos1.z

    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**
   * Update target based on available targets and proximity
   *
   * Extracted from v33 lines 1018-1052:
   * - Find nearest valid target within aggro range
   * - Update target if conditions met
   * - Clear target if current target is invalid
   *
   * @param {Object} attackerPos - Attacker position {x, y, z}
   * @param {Array} availableTargets - Array of potential targets
   * @param {string} availableTargets[].id - Target entity ID
   * @param {Object} availableTargets[].position - Target position
   * @param {number} availableTargets[].health - Target health
   * @param {boolean} availableTargets[].isDead - Target dead state
   * @returns {Object} Result with changed flag and nearest target
   */
  updateTarget(attackerPos, availableTargets) {
    let nearestTarget = null
    let nearestDistance = Infinity

    // Find nearest valid target within aggro range (v33 lines 1018-1028)
    for (const target of availableTargets) {
      if (!this.isTargetValid(target)) {
        continue
      }

      const distance = this.getDistance(attackerPos, target.position)

      if (distance < this.aggroRange && distance < nearestDistance) {
        nearestTarget = target
        nearestDistance = distance
      }
    }

    // Determine if target changed
    const previousTarget = this.currentTarget
    const changed = nearestTarget
      ? nearestTarget.id !== previousTarget
      : previousTarget !== null

    // Update target (v33 lines 1051, 1126)
    if (nearestTarget) {
      this.setTarget(nearestTarget.id)
    } else {
      this.clearTarget()
    }

    return {
      changed,
      nearestTarget,
      nearestDistance: nearestTarget ? nearestDistance : null
    }
  }
}

export default TargetingComponent
