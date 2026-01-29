/**
 * CombatComponent.js
 * Pure combat component with no framework dependencies
 *
 * Extracted from v33's combat-api-bridge.js (lines 242-370)
 * Refactored to be:
 * - Pure and framework-agnostic
 * - Testable in isolation
 * - No network, world, or entity coupling
 * - Returns values instead of emitting events
 *
 * The CombatSystem will handle:
 * - Event emission
 * - Network synchronization
 * - World integration
 * - Animation triggers
 */

class CombatComponent {
  /**
   * Initialize combat component
   * @param {Object} config - Combat configuration
   * @param {number} config.maxHealth - Maximum health points (default: 100)
   * @param {number} config.armor - Armor points for damage mitigation (default: 0)
   * @param {Object} config.damage - Damage range
   * @param {number} config.damage.min - Minimum damage (default: 1)
   * @param {number} config.damage.max - Maximum damage (default: 10)
   */
  constructor(config = {}) {
    // Initialize health
    this.maxHealth = config.maxHealth ?? 100
    this.currentHealth = this.maxHealth

    // Initialize armor
    this.armor = config.armor ?? 0

    // Initialize damage range
    this.damageMin = config.damage?.min ?? 1
    this.damageMax = config.damage?.max ?? 10

    // Initialize state
    this.isDead = false
  }

  /**
   * Apply damage to this entity
   * @param {number} amount - Raw damage amount before armor mitigation
   * @returns {Object} Result object with damage details
   */
  takeDamage(amount) {
    // Validate input
    const rawDamage = Math.max(0, amount)

    // Cannot damage dead entities
    if (this.isDead) {
      return {
        success: false,
        error: 'Entity is already dead',
        damageDealt: 0,
        oldHealth: 0,
        newHealth: 0,
        died: true
      }
    }

    // Store old health for result
    const oldHealth = this.currentHealth

    // Apply armor mitigation (simple subtraction, like EQ)
    // If armor >= damage, no damage is dealt
    const actualDamage = Math.max(0, rawDamage - this.armor)

    // Apply damage and clamp to zero
    this.currentHealth = Math.max(0, this.currentHealth - actualDamage)

    // Check if entity died
    const died = this.currentHealth <= 0
    if (died) {
      this.isDead = true
    }

    return {
      success: true,
      damageDealt: actualDamage,
      oldHealth,
      newHealth: this.currentHealth,
      died
    }
  }

  /**
   * Heal this entity
   * @param {number} amount - Amount to heal
   * @returns {Object} Result object with healing details
   */
  heal(amount) {
    // Validate input
    const healAmount = Math.max(0, amount)

    // Cannot heal dead entities
    if (this.isDead) {
      return {
        success: false,
        error: 'Cannot heal dead entity',
        healAmount: 0,
        oldHealth: 0,
        newHealth: 0
      }
    }

    // Store old health
    const oldHealth = this.currentHealth

    // Apply healing, capped at max health
    const potentialHealth = this.currentHealth + healAmount
    this.currentHealth = Math.min(this.maxHealth, potentialHealth)

    // Calculate actual healing (may be less if at/near max)
    const actualHealing = this.currentHealth - oldHealth

    return {
      success: true,
      healAmount: actualHealing,
      oldHealth,
      newHealth: this.currentHealth
    }
  }

  /**
   * Reset entity to full health and alive state
   * Used for respawn mechanics
   */
  reset() {
    this.currentHealth = this.maxHealth
    this.isDead = false
  }

  /**
   * Calculate random damage within configured range
   * Matches v33 formula: Math.random() * (max - min + 1) + min
   * @returns {number} Random damage value
   */
  calculateDamage() {
    return Math.floor(
      Math.random() * (this.damageMax - this.damageMin + 1) + this.damageMin
    )
  }

  /**
   * Get current combat state
   * @returns {Object} Current state snapshot
   */
  getState() {
    return {
      currentHealth: this.currentHealth,
      maxHealth: this.maxHealth,
      armor: this.armor,
      isDead: this.isDead,
      healthPercent: (this.currentHealth / this.maxHealth) * 100
    }
  }

  /**
   * Check if entity is alive
   * @returns {boolean} True if alive
   */
  isAlive() {
    return !this.isDead && this.currentHealth > 0
  }

  /**
   * Get health percentage
   * @returns {number} Health as percentage (0-100)
   */
  getHealthPercent() {
    return (this.currentHealth / this.maxHealth) * 100
  }
}

export default CombatComponent
