/**
 * TargetingSystem - v35 Click-to-Target System with BoundingBox Integration
 *
 * Enhanced targeting system with v34's production-grade BoundingBox system
 * Creates invisible collision meshes for entities and inserts them into octree
 * Uses v35's raycasting API with fail-fast validation
 *
 * Responsibilities:
 * - Create and manage bounding boxes for targetable entities
 * - Listen for canvas click events
 * - Raycast to find clicked entities via octree
 * - Validate and filter targetable entities
 * - Emit targeting events for UI components
 */

import { System } from '../../../core/systems/System.js'
import { CombatEvents } from '../events/CombatEvents.js'
import TargetingComponent from '../core/TargetingComponent.js'
import { BoundingBoxSystem } from '../targeting/BoundingBoxSystem.js'
import { BoundingBoxRenderer } from '../targeting/BoundingBoxRenderer.js'
import { TargetingCore } from '../targeting/TargetingCore.js'

export class TargetingSystem extends System {
  constructor(world) {
    super(world)

    // Initialize BoundingBox subsystems
    this.boundingBoxes = new BoundingBoxSystem()
    this.renderer = null // Created in init()
    this.core = new TargetingCore(world)

    this.currentTarget = null
    this.enabled = true
    this.initialized = false

    // Targeting components per entity: Map<entityId, TargetingComponent>
    this.targetingComponents = new Map()

    // Bind handlers
    this.handleClick = this.handleClick.bind(this)
    this.onEntityAdded = this.onEntityAdded.bind(this)
    this.onEntityRemoved = this.onEntityRemoved.bind(this)
  }

  /**
   * Initialize system
   */
  async init() {
    console.log('[TargetingSystem] Initializing...')

    // Wait for stage to be ready
    await this.waitForStage()

    // Validate dependencies (fail-fast)
    await this.validateDependencies()

    // Create renderer
    this.renderer = new BoundingBoxRenderer(this.world, this.boundingBoxes)
    this.renderer.init()

    // Listen for canvas clicks
    if (this.world.graphics?.renderer?.domElement) {
      const canvas = this.world.graphics.renderer.domElement
      canvas.addEventListener('click', this.handleClick)
      console.log('[TargetingSystem] Click-to-target enabled')
    } else {
      console.error('[TargetingSystem] CRITICAL: Canvas not available!')
      throw new Error('Canvas not available for click-to-target')
    }

    // Attach entity event listeners
    this.world.entities.on('added', this.onEntityAdded)
    this.world.entities.on('removed', this.onEntityRemoved)

    // Create boxes for existing entities
    this.createExistingBoxes()

    this.initialized = true
    console.log('[TargetingSystem] Initialized successfully')
  }

  /**
   * Wait for stage to be ready
   */
  async waitForStage() {
    return new Promise((resolve) => {
      const checkReady = () => {
        return !!(this.world.stage?.octree && this.world.stage?.scene && this.world.graphics?.renderer)
      }

      if (checkReady()) {
        console.log('[TargetingSystem] Stage ready')
        resolve()
        return
      }

      console.log('[TargetingSystem] Waiting for stage...')
      const checkInterval = setInterval(() => {
        if (checkReady()) {
          clearInterval(checkInterval)
          console.log('[TargetingSystem] Stage ready')
          resolve()
        }
      }, 100)

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        console.error('[TargetingSystem] Stage not ready after 30s!')
        resolve() // Continue anyway
      }, 30000)
    })
  }

  /**
   * Validate dependencies (fail-fast)
   */
  async validateDependencies() {
    const checks = [
      { name: 'world.stage', value: this.world.stage },
      { name: 'world.stage.octree', value: this.world.stage?.octree },
      { name: 'world.stage.scene', value: this.world.stage?.scene },
      { name: 'world.graphics.renderer', value: this.world.graphics?.renderer },
      { name: 'world.graphics.renderer.domElement', value: this.world.graphics?.renderer?.domElement },
      { name: 'world.entities', value: this.world.entities },
    ]

    const missing = checks.filter(c => !c.value)

    if (missing.length > 0) {
      const names = missing.map(c => c.name).join(', ')
      console.error('[TargetingSystem] FAIL-FAST: Missing dependencies:', names)
      throw new Error(`TargetingSystem missing dependencies: ${names}`)
    }

    console.log('[TargetingSystem] ✅ All dependencies validated')
  }

  /**
   * Create bounding boxes for all existing entities
   */
  createExistingBoxes() {
    if (!this.world.entities?.items) {
      console.warn('[TargetingSystem] No entities.items available')
      return
    }

    let count = 0
    let skipped = 0

    for (const [id, entity] of this.world.entities.items) {
      if (this.core.isTargetable(entity)) {
        this.createBoundingBox(entity)
        count++
      } else {
        skipped++
      }
    }

    console.log(`[TargetingSystem] Created ${count} bounding boxes (skipped ${skipped})`)
  }

  /**
   * Create bounding box for entity
   */
  createBoundingBox(entity) {
    if (!entity?.data?.id) return

    const position = this.core.resolveEntityPosition(entity)
    if (!position) {
      console.warn(`[TargetingSystem] No position for entity ${entity.data.id}`)
      return
    }

    // Default dimensions (can be customized per entity type)
    const dimensions = {
      width: entity.data?.width || 1.0,
      height: entity.data?.height || 2.0,
      depth: entity.data?.depth || 1.0,
    }

    // Create math representation
    this.boundingBoxes.createBox(entity.data.id, dimensions, position)

    // Create visual mesh (if renderer ready)
    if (this.renderer) {
      this.renderer.createMesh(entity.data.id, dimensions, position)
    }
  }

  /**
   * Handle entity added
   */
  onEntityAdded(entity) {
    if (this.core.isTargetable(entity)) {
      // Wait a bit for entity to fully initialize
      setTimeout(() => {
        this.createBoundingBox(entity)
      }, 500)
    }
  }

  /**
   * Handle entity removed
   */
  onEntityRemoved(entity) {
    if (!entity?.data?.id) return

    // Remove bounding box
    this.boundingBoxes.removeBox(entity.data.id)

    // Renderer handles its own cleanup via event listener

    // Clear target if removed
    if (this.currentTarget?.data?.id === entity.data.id) {
      this.clearTarget()
    }
  }

  /**
   * Start system
   */
  start() {
    console.log('[TargetingSystem] Started')
  }

  /**
   * Add targeting component for entity
   * @param {string} entityId - Entity ID
   * @param {Object} config - Targeting configuration
   */
  addTargeting(entityId, config = {}) {
    if (!entityId) return

    const component = new TargetingComponent(config)
    this.targetingComponents.set(entityId, component)
  }

  /**
   * Remove targeting component
   * @param {string} entityId - Entity ID
   */
  removeTargeting(entityId) {
    if (!entityId) return

    this.targetingComponents.delete(entityId)
  }

  /**
   * Handle canvas click event
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    if (!this.enabled || !this.initialized) return

    try {
      // Raycast at click position
      // v35 API: world.stage.raycastPointer(position, layers, min, max)
      const hits = this.world.stage.raycastPointer(
        { x: event.clientX, y: event.clientY },
        undefined, // layers (undefined = all)
        0,         // min distance
        1000       // max distance
      )

      if (hits.length === 0) {
        this.clearTarget()
        return
      }

      // Find targetable entities from hits
      const validTargets = this.core.filterValidTargets(hits)

      if (validTargets.length === 0) {
        this.clearTarget()
        return
      }

      // Select best target (closest)
      const bestTarget = this.core.selectBestTarget(validTargets)

      // Get the actual entity
      const entity = bestTarget.entity || bestTarget.getEntity?.()

      if (entity) {
        this.setTarget(entity)
      }
    } catch (error) {
      console.error('[TargetingSystem] Error handling click:', error)
    }
  }

  /**
   * Check if entity is targetable (wrapper for TargetingCore)
   * @param {Object} entity - Entity to check
   * @returns {boolean} True if targetable
   */
  isTargetable(entity) {
    return this.core.isTargetable(entity)
  }

  /**
   * Resolve entity name from multiple sources
   * @param {Object} entity - Entity to get name from
   * @returns {string} Entity name
   */
  resolveEntityName(entity) {
    // Try multiple name sources in priority order
    // Check blueprint.name first (mobs/NPCs store name here)
    if (entity.blueprint?.name) return entity.blueprint.name
    if (entity.data?.name) return entity.data.name
    if (entity.nametag?.name) return entity.nametag.name
    if (entity.name) return entity.name

    // Fallback to blueprint type or ID
    if (entity.data?.blueprint) {
      // Clean up blueprint name (e.g., "npc-guard" -> "Guard")
      const blueprint = entity.data.blueprint.replace(/^(npc-|mob-)/i, '')
      return blueprint.charAt(0).toUpperCase() + blueprint.slice(1)
    }

    return entity.data?.id || 'Unknown'
  }

  /**
   * Set current target
   * @param {Object} entity - Target entity
   */
  setTarget(entity) {
    this.currentTarget = entity

    const name = this.resolveEntityName(entity)
    const health = entity.data?.health || entity.nametag?.health || 0
    const maxHealth = entity.data?.maxHealth || entity.nametag?.maxHealth || 100

    // Emit targeting event
    this.world.events.emit(CombatEvents.TARGET_CHANGED, {
      target: entity,
      targetId: entity.data.id,
      name,
      health,
      maxHealth,
      timestamp: Date.now()
    })
  }

  /**
   * Clear current target
   */
  clearTarget() {
    if (this.currentTarget) {
      this.currentTarget = null

      this.world.events.emit(CombatEvents.TARGET_CHANGED, {
        target: null,
        targetId: null,
        timestamp: Date.now()
      })
    }
  }

  /**
   * Get current target
   * @returns {Object|null} Current target entity
   */
  getTarget() {
    return this.currentTarget
  }

  /**
   * Get target for specific entity (for Apps API)
   * @param {string} entityId - Entity ID
   * @returns {string|null} Target entity ID
   */
  getTargetForEntity(entityId) {
    const component = this.targetingComponents.get(entityId)
    return component?.currentTarget || null
  }

  /**
   * Check if target is in range
   * @param {number} maxRange - Maximum range
   * @returns {boolean} True if target in range
   */
  isTargetInRange(maxRange = 30) {
    if (!this.currentTarget) return false

    const player = this.world.entities.player
    if (!player) return false

    const playerPos = player.position?.value || { x: 0, y: 0, z: 0 }
    const targetPos = this.currentTarget.position?.value || { x: 0, y: 0, z: 0 }

    const dx = targetPos.x - playerPos.x
    const dy = targetPos.y - playerPos.y
    const dz = targetPos.z - playerPos.z

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    return distance <= maxRange
  }

  /**
   * Update loop - Update mesh positions to follow entities
   * @param {number} delta - Time delta
   */
  update(delta) {
    if (!this.initialized || !this.renderer) return

    // Update all mesh positions (follow entities)
    this.renderer.updateAll()
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    if (this.world.graphics?.renderer?.domElement) {
      const canvas = this.world.graphics.renderer.domElement
      canvas.removeEventListener('click', this.handleClick)
    }

    // Cleanup entity listeners
    this.world.entities.off('added', this.onEntityAdded)
    this.world.entities.off('removed', this.onEntityRemoved)

    // Cleanup renderer
    if (this.renderer) {
      this.renderer.destroy()
    }

    this.targetingComponents.clear()
    this.currentTarget = null

    console.log('[TargetingSystem] Destroyed')
  }
}
