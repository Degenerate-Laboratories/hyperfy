/**
 * AbilityComponent - Framework-agnostic ability/spell system
 *
 * Extracted and refactored from v33 combat-api-bridge.js (lines 557-810)
 * Provides flexible, data-driven ability management with cooldown tracking
 *
 * Features:
 * - Registry of abilities with cooldowns
 * - Independent cooldown tracking per ability
 * - Ability metadata (damage, range, knockback, etc.)
 * - Pure logic, no framework dependencies
 *
 * Usage:
 *   const abilities = new AbilityComponent()
 *   abilities.registerAbility(1, { id: 1, name: 'Fireball', cooldown: 5000, damage: 50 })
 *   if (abilities.canUseAbility(1)) {
 *     abilities.useAbility(1)
 *   }
 */

class AbilityComponent {
  constructor() {
    /**
     * Registry of all registered abilities
     * @type {Object.<number, Object>}
     */
    this.abilities = {}

    /**
     * Cooldown tracking: { abilityId: cooldownEndsAt }
     * @type {Object.<number, number>}
     */
    this.cooldowns = {}
  }

  /**
   * Register a new ability
   * @param {number} id - Unique ability ID
   * @param {Object} config - Ability configuration
   * @param {number} config.id - Ability ID (should match first param)
   * @param {string} config.name - Ability name
   * @param {number} config.cooldown - Cooldown duration in milliseconds
   * @param {string} [config.type] - Ability type (damage, heal, buff)
   * @param {number} [config.damage] - Damage amount
   * @param {number} [config.heal] - Heal amount
   * @param {number} [config.defense] - Defense bonus
   * @param {number} [config.range] - Ability range
   * @param {number} [config.duration] - Buff/debuff duration
   * @param {Object} [config.knockback] - Knockback configuration
   */
  registerAbility(id, config) {
    this.abilities[id] = { ...config }
  }

  /**
   * Get ability configuration
   * @param {number} id - Ability ID
   * @returns {Object|null} Ability config or null if not found
   */
  getAbility(id) {
    return this.abilities[id] || null
  }

  /**
   * Check if ability exists
   * @param {number} id - Ability ID
   * @returns {boolean} True if ability is registered
   */
  hasAbility(id) {
    return id in this.abilities
  }

  /**
   * Get all registered abilities
   * @returns {Object.<number, Object>} All abilities
   */
  getAllAbilities() {
    return { ...this.abilities }
  }

  /**
   * Check if ability is ready (not on cooldown)
   * @param {number} id - Ability ID
   * @returns {boolean} True if ready to use
   */
  isReady(id) {
    if (!this.hasAbility(id)) {
      return false
    }

    const cooldownEndsAt = this.cooldowns[id]
    if (!cooldownEndsAt) {
      return true // Never used, no cooldown
    }

    return Date.now() >= cooldownEndsAt
  }

  /**
   * Alias for isReady() for backwards compatibility
   * @param {number} id - Ability ID
   * @returns {boolean} True if ready to use
   */
  canUseAbility(id) {
    return this.isReady(id)
  }

  /**
   * Use an ability (starts cooldown)
   * @param {number} id - Ability ID
   * @returns {Object} Result object with success status
   */
  useAbility(id) {
    // Check if ability exists
    if (!this.hasAbility(id)) {
      return {
        success: false,
        error: `Ability ${id} not found`
      }
    }

    // Check if on cooldown
    if (!this.isReady(id)) {
      const remaining = this.getCooldownRemaining(id)
      return {
        success: false,
        error: `Ability on cooldown (${Math.ceil(remaining / 1000)}s remaining)`
      }
    }

    const ability = this.getAbility(id)
    const cooldownEndsAt = Date.now() + ability.cooldown

    // Start cooldown
    this.cooldowns[id] = cooldownEndsAt

    return {
      success: true,
      cooldownEndsAt,
      ability: { ...ability }
    }
  }

  /**
   * Get remaining cooldown time in milliseconds
   * @param {number} id - Ability ID
   * @returns {number} Remaining cooldown in ms (0 if ready)
   */
  getCooldownRemaining(id) {
    if (!this.hasAbility(id)) {
      return 0
    }

    const cooldownEndsAt = this.cooldowns[id]
    if (!cooldownEndsAt) {
      return 0 // Never used
    }

    const remaining = cooldownEndsAt - Date.now()
    return Math.max(0, remaining)
  }

  /**
   * Manually reset cooldown for an ability
   * Useful for testing or special game mechanics
   * @param {number} id - Ability ID
   */
  resetCooldown(id) {
    if (this.hasAbility(id)) {
      delete this.cooldowns[id]
    }
  }

  /**
   * Reset all cooldowns
   * Useful for testing or respawn mechanics
   */
  resetAllCooldowns() {
    this.cooldowns = {}
  }

  /**
   * Get cooldown status for all abilities
   * @returns {Object} Cooldown status { abilityId: { ready, remaining } }
   */
  getCooldownStatus() {
    const status = {}
    for (const id in this.abilities) {
      status[id] = {
        ready: this.isReady(id),
        remaining: this.getCooldownRemaining(id)
      }
    }
    return status
  }
}

export default AbilityComponent
