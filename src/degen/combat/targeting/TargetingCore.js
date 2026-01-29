/**
 * TargetingCore - Pure Logic Targeting Validation
 *
 * 100% testable targeting logic with ZERO THREE.js dependencies.
 * All validation, filtering, and distance calculations are pure functions.
 *
 * v33 Problem: Targeting logic was untestable due to tight coupling with THREE.js raycasting.
 * v34 Solution: Extract pure logic into this class, inject raycasting at runtime.
 */

export class TargetingCore {
  constructor(world) {
    this.world = world
  }

  /**
   * Validates if an entity can be targeted
   * @param {Object} entity - Entity to validate
   * @returns {boolean} - True if entity can be targeted
   */
  isTargetable(entity) {
    // Must have entity data
    if (!entity || !entity.data) return false

    // Must not be the scene itself
    if (entity.data.blueprint === '$scene') return false

    // Must not be dead (explicit boolean check handles undefined)
    if (entity.data.isDead === true) return false

    // Must have health (attackable) - check both entity.data and nametag
    const hasMaxHealth =
      entity.data.maxHealth !== undefined || entity.nametag?.maxHealth !== undefined
    if (!hasMaxHealth) return false

    // Must not be the player
    if (entity === this.world.entities.player) return false

    return true
  }

  /**
   * Filters raycast hits to only valid targetable entities
   * @param {Array} hits - Array of raycast hits
   * @returns {Array} - Filtered array of valid targets
   */
  filterValidTargets(hits) {
    if (!hits || hits.length === 0) return []

    return hits.filter(hit => {
      // Support both direct entity property and getEntity() callback (v33 compatibility)
      const entity = hit.entity || hit.getEntity?.()
      return entity && this.isTargetable(entity)
    })
  }

  /**
   * Selects the best target from candidates (closest)
   * @param {Array} candidates - Array of valid target candidates
   * @returns {Object|null} - Best target or null
   */
  selectBestTarget(candidates) {
    if (!candidates || candidates.length === 0) return null

    // Pick closest target
    let closest = candidates[0]
    for (const candidate of candidates) {
      if (candidate.distance < closest.distance) {
        closest = candidate
      }
    }

    return closest
  }

  /**
   * Validates if target is within attack range (2D distance)
   * @param {Object} source - Source position {x, y, z}
   * @param {Object} target - Target position {x, y, z}
   * @param {number} maxRange - Maximum range
   * @returns {boolean} - True if in range
   */
  validateRange(source, target, maxRange) {
    if (!source || !target) return false

    // Calculate 2D distance (ignore Y for gameplay reasons)
    const dx = target.x - source.x
    const dz = target.z - source.z
    const distance = Math.sqrt(dx * dx + dz * dz)

    return distance <= maxRange
  }

  /**
   * Calculates 2D distance between two positions (ignores Y)
   * @param {Object} pos1 - First position {x, y, z}
   * @param {Object} pos2 - Second position {x, y, z}
   * @returns {number} - Distance in meters
   */
  getDistance2D(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity

    const dx = pos2.x - pos1.x
    const dz = pos2.z - pos1.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  /**
   * Resolves entity position from multiple sources (App vs PlayerRemote)
   * @param {Object} entity - Entity with position data
   * @returns {Object|null} - Position {x, y, z} or null
   */
  resolveEntityPosition(entity) {
    if (!entity) return null

    // Try multiple position sources (App entities use root, PlayerRemote use base)
    const pos = entity.root?.position || entity.base?.position || entity.position
    if (!pos) return null

    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
    }
  }
}
