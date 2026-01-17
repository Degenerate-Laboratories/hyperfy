/**
 * NPC - Container class for NPC entities
 *
 * Wraps a Mob entity and AIController and manages attached systems.
 * Provides a clean interface for NPC behavior and state management.
 */
export class NPC {
  /**
   * Create NPC container
   * @param {string} id - Unique NPC identifier
   * @param {Object} config - NPC configuration
   * @param {Mob} mob - Mob entity
   * @param {AIController} [aiController] - AI controller (optional)
   */
  constructor(id, config, mob, aiController = null) {
    this.id = id
    this.config = config
    this.mob = mob
    this.aiController = aiController
    this.systems = new Map()
    this.isAlive = true

    // Bind to mob events
    this._bindMobEvents()
  }

  /**
   * Bind to mob lifecycle events
   * @private
   */
  _bindMobEvents() {
    if (!this.mob) return

    // Handle death
    this.mob.on('death', () => {
      this.isAlive = false
      console.log(`[NPC] ${this.id} died`)
    })

    // Handle health changes
    this.mob.on('healthChanged', (health, oldHealth) => {
      // Systems can listen to mob events directly if needed
    })
  }

  /**
   * Add a system to this NPC
   * @param {string} name - System name
   * @param {Object} system - System instance
   */
  addSystem(name, system) {
    if (this.systems.has(name)) {
      console.warn(`[NPC] ${this.id} already has system: ${name}`)
      return
    }

    // Bind system to this NPC
    system.npc = this

    // Initialize system
    if (typeof system.init === 'function') {
      system.init()
    }

    this.systems.set(name, system)
    console.log(`[NPC] ${this.id} added system: ${name}`)
  }

  /**
   * Get a system by name
   * @param {string} name - System name
   * @returns {Object|undefined} System instance
   */
  getSystem(name) {
    return this.systems.get(name)
  }

  /**
   * Check if NPC has a system
   * @param {string} name - System name
   * @returns {boolean} True if system exists
   */
  hasSystem(name) {
    return this.systems.has(name)
  }

  /**
   * Remove a system
   * @param {string} name - System name
   */
  removeSystem(name) {
    const system = this.systems.get(name)
    if (!system) return

    // Destroy system
    if (typeof system.destroy === 'function') {
      system.destroy()
    }

    this.systems.delete(name)
    console.log(`[NPC] ${this.id} removed system: ${name}`)
  }

  /**
   * Update all systems
   * @param {number} delta - Time delta in seconds
   */
  update(delta) {
    if (!this.isAlive) return

    for (const [name, system] of this.systems) {
      try {
        if (typeof system.update === 'function') {
          system.update(delta)
        }
      } catch (error) {
        console.error(`[NPC] ${this.id} system ${name} update error:`, error)
      }
    }
  }

  /**
   * Destroy this NPC and all systems
   */
  destroy() {
    console.log(`[NPC] ${this.id} destroying...`)

    this.isAlive = false

    // Destroy all systems
    for (const [name, system] of this.systems) {
      try {
        if (typeof system.destroy === 'function') {
          system.destroy()
        }
      } catch (error) {
        console.error(`[NPC] ${this.id} system ${name} destroy error:`, error)
      }
    }

    this.systems.clear()

    // Destroy AI controller
    if (this.aiController && typeof this.aiController.destroy === 'function') {
      this.aiController.destroy()
    }

    // Note: Mob entity is destroyed by the adapter, not here
  }

  /**
   * Get NPC position
   * @returns {Array<number>} Position [x, y, z]
   */
  getPosition() {
    if (!this.mob) return [0, 0, 0]
    return this.mob.root?.position || this.mob.data.position || [0, 0, 0]
  }

  /**
   * Get NPC name
   * @returns {string} NPC name
   */
  getName() {
    return this.mob?.data.name || this.config.name || 'NPC'
  }

  /**
   * Get NPC health
   * @returns {number} Current health
   */
  getHealth() {
    return this.mob?.data.health ?? 0
  }

  /**
   * Get NPC max health
   * @returns {number} Maximum health
   */
  getMaxHealth() {
    return this.mob?.data.maxHealth ?? 100
  }

  /**
   * Check if NPC is alive
   * @returns {boolean} True if alive
   */
  alive() {
    return this.isAlive && this.getHealth() > 0
  }
}
