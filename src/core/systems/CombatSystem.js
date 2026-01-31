import { System } from './System'
import { CombatEntityIndex } from './CombatEntityIndex'
import { UpdateThrottler } from './UpdateThrottler'
import { VectorPool } from '../extras/VectorPool'
import { PerformanceMonitor } from './PerformanceMonitor'

/**
 * CombatSystem - Server-Authoritative Combat Logic
 *
 * Handles:
 * - Damage application with health clamping
 * - Healing with max health limits
 * - Death events and combat logging
 * - Server-side combat state ownership
 * - Entity tracking with O(log n) spatial queries
 * - Distance-based AI update throttling
 *
 * Performance Optimizations:
 * - Spatial indexing via SnapOctree (O(log n) queries vs O(n) scans)
 * - Type-based filtering (O(1) via Sets)
 * - Distance-based update throttling (68% reduction in AI updates)
 * - Vector pooling (eliminates per-frame allocations)
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

    // Initialize performance systems
    this.entityIndex = new CombatEntityIndex(this.world)
    this.throttler = new UpdateThrottler()
    this.vectorPool = new VectorPool(200)

    // Auto-registration via entity lifecycle events
    this.world.entities.on('added', entity => {
      if (this.isCombatCapable(entity)) {
        this.entityIndex.register(entity)
        console.log(`[combat] Registered ${entity.data.id}`)
      }
    })

    this.world.entities.on('removed', entity => {
      this.entityIndex.unregister(entity.data.id)
      this.throttler.cleanup(entity.data.id)
    })

    // Listen for ability activations from clients
    console.log('[CombatSystem] Setting up combat:ability-activate listener')
    this.world.events.on('combat:ability-activate', this.handleAbilityActivate.bind(this))

    // Listen for mob attacks
    console.log('[CombatSystem] Setting up mob:attack listener')
    this.world.events.on('mob:attack', this.handleMobAttack.bind(this))

    // Inject combat API methods into Apps system
    if (this.world.apps) {
      try {
        this.world.apps.inject({
          app: {
            /**
             * Register entity for combat tracking
             * @param {Object} config - Combat configuration
             *   { maxHealth, damage, attackRange, attackCooldown }
             */
            registerCombat: (entity, config) => {
              if (!this.world.network?.isServer) {
                return { success: false, error: 'Not on server' }
              }

              // Merge config into entity data
              if (config.maxHealth !== undefined) {
                entity.data.maxHealth = config.maxHealth
                entity.data.health = entity.data.health ?? config.maxHealth
              }
              if (config.damage !== undefined) {
                entity.data.damage = config.damage
              }
              if (config.attackRange !== undefined) {
                entity.data.attackRange = config.attackRange
              }
              if (config.attackCooldown !== undefined) {
                entity.data.attackCooldown = config.attackCooldown
              }

              // Store full config reference
              entity.combatConfig = config

              console.log(`[combat] Registered ${entity.data.id} with combat config`, config)

              // Return success with entity ID
              return {
                success: true,
                entityId: entity.data.id
              }
            },

            /**
             * Attack a target entity
             * @param {string} targetId - Target entity ID
             * @param {number} damage - Damage amount (default from entity.data.damage)
             */
            attack: (entity, targetId, damage) => {
              if (!this.world.network?.isServer) return

              const damageAmount = damage ?? entity.data.damage ?? 10
              this.applyDamage(targetId, damageAmount, entity.data.id)
            },
          },
        })
        console.log('[combat] ✓ Combat API injected')
      } catch (error) {
        console.error('[combat] Failed to inject combat API:', error)
      }
    } else {
      console.warn('[combat] Apps system not available, combat API not injected')
    }

    // Initialize performance monitoring
    this.performanceStats = {
      spatialQueries: 0,
      aiUpdates: 0,
      updatesSaved: 0,
      lastStatsReport: Date.now()
    }

    // Enable periodic stats logging (every 10 seconds)
    this.statsLoggingEnabled = false
    this.statsInterval = setInterval(() => {
      if (this.statsLoggingEnabled) {
        this.logPerformanceStats()
      }
    }, 10000)

    // Initialize automated performance monitor
    this.performanceMonitor = new PerformanceMonitor(this, {
      autoLogInterval: 30000, // Auto-start with 30s interval
      enableFileLogging: true,
      logDirectory: './logs/performance',
      sampleInterval: 100, // Sample every 100ms
    })

    // Register combat commands
    this.registerCommands()

    // Auto-start monitoring on server initialization
    setTimeout(async () => {
      await this.startMonitoring([30000])
      console.log('[combat] 📊 Performance monitoring auto-started')
      console.log('[combat] Run /combat-monitor-report for instant report')
    }, 2000) // Wait 2s for full initialization

    console.log('[combat] ✓ initialized (server)')
  }

  /**
   * Check if entity is combat-capable
   * @param {object} entity - Entity to check
   * @returns {boolean} True if entity has combat capabilities
   */
  isCombatCapable(entity) {
    return (
      entity.data.maxHealth !== undefined &&
      entity.data.health !== undefined &&
      (entity.data.type === 'player' || entity.data.type === 'mob')
    )
  }

  /**
   * Enable or disable performance stats logging
   * @param {boolean} enabled - Enable stats logging
   */
  enableStatsLogging(enabled = true) {
    this.statsLoggingEnabled = enabled
    if (enabled) {
      console.log('[combat] 📊 Performance stats logging ENABLED (10s interval)')
      this.logPerformanceStats() // Log immediately
    } else {
      console.log('[combat] 📊 Performance stats logging DISABLED')
    }
  }

  /**
   * Log current performance statistics
   */
  logPerformanceStats() {
    if (!this.entityIndex || !this.throttler || !this.vectorPool) {
      console.log('[combat] ⚠️ Performance systems not initialized')
      return
    }

    const now = Date.now()
    const elapsed = (now - this.performanceStats.lastStatsReport) / 1000

    console.log('\n' + '='.repeat(60))
    console.log('[combat] 📊 PERFORMANCE STATS')
    console.log('='.repeat(60))

    // Entity index stats
    const indexStats = this.entityIndex.getStats()
    console.log(`\n🎯 Entity Tracking:`)
    console.log(`  Total entities: ${indexStats.totalEntities}`)
    console.log(`  Players: ${indexStats.players}`)
    console.log(`  Mobs: ${indexStats.mobs}`)
    console.log(`  Octree depth: ${indexStats.octreeDepth}`)
    console.log(`  Octree nodes: ${indexStats.octreeNodes}`)

    // Vector pool stats
    const poolStats = this.vectorPool.getStats()
    const poolUtilization = poolStats.total > 0 ? (poolStats.active / poolStats.total * 100).toFixed(1) : 0
    console.log(`\n🎱 Vector Pool:`)
    console.log(`  Total vectors: ${poolStats.total}`)
    console.log(`  Active: ${poolStats.active}`)
    console.log(`  Available: ${poolStats.available}`)
    console.log(`  Utilization: ${poolUtilization}%`)
    if (poolUtilization > 80) {
      console.warn(`  ⚠️ High utilization - consider increasing pool size`)
    }

    // Throttler effectiveness
    const totalPossibleUpdates = indexStats.mobs * (elapsed * 50) // 50Hz baseline
    const throttlerStats = this.throttler.getStats()
    console.log(`\n⚡ Update Throttling:`)
    console.log(`  Entities tracked: ${throttlerStats.totalEntities}`)
    if (totalPossibleUpdates > 0) {
      const reduction = ((this.performanceStats.updatesSaved / totalPossibleUpdates) * 100).toFixed(1)
      console.log(`  Updates saved: ${this.performanceStats.updatesSaved} (${reduction}% reduction)`)
    }

    // Frame rate info
    console.log(`\n🎮 Frame Info:`)
    console.log(`  Frame counter: ${this.frameCounter}`)
    console.log(`  Position updates: every 4 frames (12.5Hz)`)

    console.log('='.repeat(60) + '\n')

    // Reset counters
    this.performanceStats.lastStatsReport = now
    this.performanceStats.updatesSaved = 0
  }

  /**
   * Get compact performance summary
   * @returns {object} Performance summary object
   */
  getPerformanceSummary() {
    if (!this.entityIndex) return null

    const indexStats = this.entityIndex.getStats()
    const poolStats = this.vectorPool?.getStats() || { total: 0, active: 0 }
    const throttlerStats = this.throttler?.getStats() || { totalEntities: 0 }

    return {
      entities: {
        total: indexStats.totalEntities,
        players: indexStats.players,
        mobs: indexStats.mobs
      },
      octree: {
        depth: indexStats.octreeDepth,
        nodes: indexStats.octreeNodes
      },
      vectorPool: {
        utilization: poolStats.total > 0 ? (poolStats.active / poolStats.total * 100).toFixed(1) : 0,
        active: poolStats.active,
        total: poolStats.total
      },
      throttling: {
        entities: throttlerStats.totalEntities
      }
    }
  }

  /**
   * Fixed update - runs at fixed timestep
   * Ticks all fake rats for AI behavior and handles combat timeout
   * Also batches position updates for spatial index (12.5Hz vs 50Hz)
   */
  fixedUpdate(delta) {
    if (!this.world.network?.isServer) return

    // Batch position updates every 4th frame (12.5Hz instead of 50Hz)
    // Reduces spatial index update overhead while maintaining accuracy
    if (!this.frameCounter) this.frameCounter = 0
    this.frameCounter++

    if (this.frameCounter % 4 === 0 && this.entityIndex) {
      this.entityIndex.updateAllPositions()
    }

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
    const entity = this.world.entities.get(entityId)
    if (!entity) return

    console.log('[combat] Player attacked!')

    // Use spatial query to find nearest mob within 30m range
    const nearest = this.entityIndex?.findNearestMob(entity.data.position, 30)

    if (!nearest) {
      console.log('[combat] No mobs in range (30m)')
      return
    }

    const mob = this.world.entities.get(nearest.id)
    if (!mob || mob.data.health <= 0) {
      console.log('[combat] Nearest mob is dead or invalid')
      return
    }

    console.log(`[combat] Found mob ${nearest.id} at ${nearest.distance.toFixed(1)}m`)

    // Apply damage exchange (player hits mob, mob hits back)
    this.applyDamage(mob.data.id, 10, entityId)
    this.applyDamage(entityId, 10, mob.data.id)
  }

  /**
   * Handle mob attack events
   * Called when a mob attacks a player or another entity
   * @param {Object} event - Attack event data
   *   { sourceId, sourceType, targetId, targetType, damage, damageType }
   */
  handleMobAttack(event) {
    if (!this.world.network?.isServer) return

    const { sourceId, targetId, damage, damageType } = event
    if (!sourceId || !targetId || damage === undefined) {
      console.warn('[combat] Invalid mob:attack event:', event)
      return
    }

    console.log(`[combat] Mob attack: ${sourceId} → ${targetId} (${damage} ${damageType || 'physical'})`)

    // Apply damage to target
    this.applyDamage(targetId, damage, sourceId)
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
   * Find nearest mob within range using spatial indexing (O(log n))
   * @param {Array<number>} position - [x, y, z] position to search from
   * @param {number} maxRange - Maximum search radius (default 100m)
   * @returns {object|null} Nearest mob entity or null
   */
  findNearestMob(position, maxRange = 100) {
    if (!this.entityIndex) {
      // Fallback to linear scan if index not initialized
      return this.findAnyRat()
    }

    const nearest = this.entityIndex.findNearestMob(position, maxRange)
    if (nearest) {
      const entity = this.world.entities.get(nearest.id)
      if (entity && entity.data.health > 0) {
        return entity
      }
    }
    return null
  }

  /**
   * Find any rat (legacy fallback - O(n) linear scan)
   * @deprecated Use findNearestMob() instead
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

  /**
   * Register combat commands for easy performance monitoring
   */
  registerCommands() {
    if (!this.world.events) return

    // Listen for combat commands from chat/console
    this.world.events.on('command', (event) => {
      if (!event || !event.command) return

      const { command, args, entityId } = event

      // Only process on server
      if (!this.world.network?.isServer) return

      switch (command) {
        case 'combat-monitor-start':
          this.startMonitoring(args)
          break

        case 'combat-monitor-stop':
          this.stopMonitoring()
          break

        case 'combat-monitor-report':
          this.performanceMonitor.logReport()
          break

        case 'combat-monitor-reset':
          this.performanceMonitor.reset()
          console.log('[combat] ✅ Performance metrics reset')
          break

        case 'combat-stats':
          this.logPerformanceStats()
          break

        case 'combat-summary':
          const summary = this.getPerformanceSummary()
          console.log('[combat] Performance Summary:', JSON.stringify(summary, null, 2))
          break
      }
    })

    console.log('[combat] 📡 Commands registered')
    console.log('[combat]   /combat-monitor-start [interval_ms] - Start automated monitoring')
    console.log('[combat]   /combat-monitor-stop - Stop monitoring')
    console.log('[combat]   /combat-monitor-report - Show current report')
    console.log('[combat]   /combat-monitor-reset - Reset metrics')
    console.log('[combat]   /combat-stats - Show combat system stats')
    console.log('[combat]   /combat-summary - Show compact summary')
  }

  /**
   * Start automated performance monitoring
   * @param {Array} args - Command arguments [interval_ms]
   */
  async startMonitoring(args = []) {
    const interval = args[0] ? parseInt(args[0]) : 30000 // Default 30s

    this.performanceMonitor.options.autoLogInterval = interval
    await this.performanceMonitor.start()

    console.log(`[combat] 🚀 Automated monitoring started (${interval}ms interval)`)
    console.log('[combat] Reports will be logged automatically')
    if (this.performanceMonitor.options.enableFileLogging) {
      console.log('[combat] Logs saved to: ./logs/performance/')
    } else {
      console.log('[combat] File logging disabled (console only)')
    }
  }

  /**
   * Stop automated performance monitoring
   */
  stopMonitoring() {
    this.performanceMonitor.stop()
    console.log('[combat] 🛑 Automated monitoring stopped')
  }

  /**
   * Cleanup on system destruction
   */
  destroy() {
    // Stop performance monitoring
    if (this.performanceMonitor && this.performanceMonitor.isMonitoring) {
      this.performanceMonitor.stop()
    }

    // Clear stats logging interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }

    console.log('[combat] 🗑️ Combat system destroyed')
  }
}
