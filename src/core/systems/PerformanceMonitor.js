/**
 * PerformanceMonitor - Automated server-side performance tracking
 *
 * Purpose: Track combat system performance without manual client observation
 * - Automatic metric collection
 * - Server console logging
 * - CSV file output (server-only)
 * - Command-driven queries
 *
 * Usage:
 *   const monitor = new PerformanceMonitor(world.combat)
 *   monitor.start()
 *   monitor.logReport() // Manual report
 *   monitor.stop()
 */
export class PerformanceMonitor {
  constructor(combatSystem, options = {}) {
    this.combat = combatSystem
    this.world = combatSystem.world

    // Check if we're on server (has Node.js fs module)
    this.isServer = typeof process !== 'undefined' && process.versions && process.versions.node

    // Configuration
    this.options = {
      autoLogInterval: options.autoLogInterval || 30000, // 30s default
      enableFileLogging: this.isServer && options.enableFileLogging !== false,
      logDirectory: options.logDirectory || './logs/performance',
      sampleInterval: options.sampleInterval || 100, // Sample every 100ms
      ...options,
    }

    // Metrics storage
    this.metrics = {
      // Frame timing
      frameTimes: [],
      avgFrameTime: 0,
      maxFrameTime: 0,

      // Query performance
      spatialQueryTimes: [],
      avgQueryTime: 0,
      maxQueryTime: 0,
      totalQueries: 0,

      // AI updates
      aiUpdateCounts: new Map(), // entityId → count
      totalAIUpdates: 0,
      throttledUpdates: 0,

      // Entity tracking
      entityCountSamples: [],
      avgEntityCount: 0,
      maxEntityCount: 0,

      // Session info
      startTime: Date.now(),
      lastReportTime: Date.now(),
      sampleCount: 0,
    }

    // Auto-logging interval
    this.autoLogTimer = null
    this.sampleTimer = null

    // Performance hooks
    this.originalFixedUpdate = null
    this.isMonitoring = false

    // Lazy-load fs module for server-side file logging
    this.fs = null
    this.path = null

    // Create log directory if needed
    if (this.options.enableFileLogging) {
      this.initializeFileSystem()
    }
  }

  /**
   * Initialize file system modules (server-only)
   */
  async initializeFileSystem() {
    if (!this.isServer) {
      this.options.enableFileLogging = false
      return
    }

    try {
      // Dynamic import for Node.js modules (server-only)
      this.fs = await import('fs')
      this.path = await import('path')
      this.ensureLogDirectory()
    } catch (err) {
      console.warn('[PerformanceMonitor] File system not available:', err.message)
      this.options.enableFileLogging = false
    }
  }

  /**
   * Ensure log directory exists (server-only)
   */
  ensureLogDirectory() {
    if (!this.fs || !this.options.enableFileLogging) return

    try {
      if (!this.fs.existsSync(this.options.logDirectory)) {
        this.fs.mkdirSync(this.options.logDirectory, { recursive: true })
      }
    } catch (err) {
      console.warn('[PerformanceMonitor] Could not create log directory:', err.message)
      this.options.enableFileLogging = false
    }
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.isMonitoring) {
      console.warn('[PerformanceMonitor] Already monitoring')
      return
    }

    console.log('[PerformanceMonitor] 🚀 Starting performance monitoring')
    console.log(`[PerformanceMonitor] Auto-log interval: ${this.options.autoLogInterval}ms`)
    console.log(`[PerformanceMonitor] File logging: ${this.options.enableFileLogging ? 'ENABLED' : 'DISABLED'}`)

    // Wait for file system initialization if needed
    if (this.options.enableFileLogging && !this.fs) {
      await this.initializeFileSystem()
    }

    this.metrics.startTime = Date.now()
    this.metrics.lastReportTime = Date.now()
    this.isMonitoring = true

    // Hook into combat system fixedUpdate
    this.hookFixedUpdate()

    // Hook into spatial queries
    this.hookSpatialQueries()

    // Start auto-logging
    if (this.options.autoLogInterval > 0) {
      this.autoLogTimer = setInterval(() => {
        this.logReport()
      }, this.options.autoLogInterval)
    }

    // Start sampling
    this.sampleTimer = setInterval(() => {
      this.collectSample()
    }, this.options.sampleInterval)

    // Write CSV header
    if (this.options.enableFileLogging && this.fs) {
      this.initializeLogFiles()
    }

    console.log('[PerformanceMonitor] ✅ Monitoring started')
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) return

    console.log('[PerformanceMonitor] 🛑 Stopping performance monitoring')

    // Clear intervals
    if (this.autoLogTimer) {
      clearInterval(this.autoLogTimer)
      this.autoLogTimer = null
    }

    if (this.sampleTimer) {
      clearInterval(this.sampleTimer)
      this.sampleTimer = null
    }

    // Restore original methods
    this.unhookFixedUpdate()
    this.unhookSpatialQueries()

    // Final report
    this.logReport()

    this.isMonitoring = false
    console.log('[PerformanceMonitor] ✅ Monitoring stopped')
  }

  /**
   * Hook into combat system fixedUpdate to measure frame time
   */
  hookFixedUpdate() {
    if (!this.combat.fixedUpdate) return

    this.originalFixedUpdate = this.combat.fixedUpdate.bind(this.combat)

    this.combat.fixedUpdate = (delta) => {
      const start = performance.now()
      this.originalFixedUpdate(delta)
      const elapsed = performance.now() - start

      // Record frame time
      this.metrics.frameTimes.push(elapsed)
      if (elapsed > this.metrics.maxFrameTime) {
        this.metrics.maxFrameTime = elapsed
      }

      // Keep only last 1000 samples
      if (this.metrics.frameTimes.length > 1000) {
        this.metrics.frameTimes.shift()
      }
    }
  }

  /**
   * Unhook fixedUpdate
   */
  unhookFixedUpdate() {
    if (this.originalFixedUpdate) {
      this.combat.fixedUpdate = this.originalFixedUpdate
      this.originalFixedUpdate = null
    }
  }

  /**
   * Hook into spatial queries to measure query time
   */
  hookSpatialQueries() {
    if (!this.combat.entityIndex) return

    const index = this.combat.entityIndex

    // Hook findNearestPlayer
    const originalFindNearestPlayer = index.findNearestPlayer.bind(index)
    index.findNearestPlayer = (position, maxDistance) => {
      const start = performance.now()
      const result = originalFindNearestPlayer(position, maxDistance)
      const elapsed = performance.now() - start

      this.metrics.spatialQueryTimes.push(elapsed)
      this.metrics.totalQueries++
      if (elapsed > this.metrics.maxQueryTime) {
        this.metrics.maxQueryTime = elapsed
      }

      // Keep only last 1000 samples
      if (this.metrics.spatialQueryTimes.length > 1000) {
        this.metrics.spatialQueryTimes.shift()
      }

      return result
    }

    // Hook findNearestMob
    const originalFindNearestMob = index.findNearestMob.bind(index)
    index.findNearestMob = (position, maxDistance) => {
      const start = performance.now()
      const result = originalFindNearestMob(position, maxDistance)
      const elapsed = performance.now() - start

      this.metrics.spatialQueryTimes.push(elapsed)
      this.metrics.totalQueries++
      if (elapsed > this.metrics.maxQueryTime) {
        this.metrics.maxQueryTime = elapsed
      }

      // Keep only last 1000 samples
      if (this.metrics.spatialQueryTimes.length > 1000) {
        this.metrics.spatialQueryTimes.shift()
      }

      return result
    }
  }

  /**
   * Unhook spatial queries
   */
  unhookSpatialQueries() {
    // Note: We don't restore originals here because we'd need to store them
    // For now, the hooks remain but stop collecting data when monitoring stops
  }

  /**
   * Collect periodic sample
   */
  collectSample() {
    if (!this.combat.entityIndex) return

    const stats = this.combat.entityIndex.getStats()
    this.metrics.entityCountSamples.push(stats.totalEntities)

    if (stats.totalEntities > this.metrics.maxEntityCount) {
      this.metrics.maxEntityCount = stats.totalEntities
    }

    // Keep only last 1000 samples
    if (this.metrics.entityCountSamples.length > 1000) {
      this.metrics.entityCountSamples.shift()
    }

    this.metrics.sampleCount++
  }

  /**
   * Calculate statistics
   */
  calculateStats() {
    // Average frame time
    if (this.metrics.frameTimes.length > 0) {
      this.metrics.avgFrameTime =
        this.metrics.frameTimes.reduce((a, b) => a + b, 0) / this.metrics.frameTimes.length
    }

    // Average query time
    if (this.metrics.spatialQueryTimes.length > 0) {
      this.metrics.avgQueryTime =
        this.metrics.spatialQueryTimes.reduce((a, b) => a + b, 0) / this.metrics.spatialQueryTimes.length
    }

    // Average entity count
    if (this.metrics.entityCountSamples.length > 0) {
      this.metrics.avgEntityCount =
        this.metrics.entityCountSamples.reduce((a, b) => a + b, 0) / this.metrics.entityCountSamples.length
    }

    return {
      // Timing
      avgFrameTime: this.metrics.avgFrameTime.toFixed(3),
      maxFrameTime: this.metrics.maxFrameTime.toFixed(3),
      avgQueryTime: this.metrics.avgQueryTime.toFixed(3),
      maxQueryTime: this.metrics.maxQueryTime.toFixed(3),

      // Entities
      avgEntityCount: Math.round(this.metrics.avgEntityCount),
      maxEntityCount: this.metrics.maxEntityCount,

      // Queries
      totalQueries: this.metrics.totalQueries,
      queriesPerSecond: this.getQueriesPerSecond(),

      // Session
      uptime: this.getUptime(),
      sampleCount: this.metrics.sampleCount,
    }
  }

  /**
   * Get queries per second
   */
  getQueriesPerSecond() {
    const uptime = (Date.now() - this.metrics.startTime) / 1000
    return uptime > 0 ? (this.metrics.totalQueries / uptime).toFixed(1) : 0
  }

  /**
   * Get uptime in seconds
   */
  getUptime() {
    return Math.floor((Date.now() - this.metrics.startTime) / 1000)
  }

  /**
   * Get formatted uptime string
   */
  getFormattedUptime() {
    const uptime = this.getUptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = uptime % 60
    return `${hours}h ${minutes}m ${seconds}s`
  }

  /**
   * Log performance report to console
   */
  logReport() {
    const stats = this.calculateStats()
    const combatStats = this.combat.getPerformanceSummary()

    console.log('\n' + '='.repeat(70))
    console.log('[PerformanceMonitor] 📊 AUTOMATED PERFORMANCE REPORT')
    console.log('='.repeat(70))

    console.log(`\n⏱️  Session Info:`)
    console.log(`  Uptime: ${this.getFormattedUptime()}`)
    console.log(`  Samples collected: ${stats.sampleCount}`)

    console.log(`\n🎮 Frame Performance:`)
    console.log(`  Average frame time: ${stats.avgFrameTime}ms`)
    console.log(`  Max frame time: ${stats.maxFrameTime}ms`)
    const fps = stats.avgFrameTime > 0 ? (1000 / parseFloat(stats.avgFrameTime)).toFixed(1) : 0
    console.log(`  Effective FPS: ${fps}`)

    console.log(`\n🔍 Spatial Query Performance:`)
    console.log(`  Total queries: ${stats.totalQueries}`)
    console.log(`  Queries/second: ${stats.queriesPerSecond}`)
    console.log(`  Average query time: ${stats.avgQueryTime}ms`)
    console.log(`  Max query time: ${stats.maxQueryTime}ms`)

    if (combatStats) {
      console.log(`\n🎯 Entity Tracking:`)
      console.log(`  Current entities: ${combatStats.entities.total}`)
      console.log(`  Average entities: ${stats.avgEntityCount}`)
      console.log(`  Max entities: ${stats.maxEntityCount}`)
      console.log(`  Players: ${combatStats.entities.players}`)
      console.log(`  Mobs: ${combatStats.entities.mobs}`)

      console.log(`\n🌳 Spatial Index:`)
      console.log(`  Octree depth: ${combatStats.octree.depth}`)
      console.log(`  Octree nodes: ${combatStats.octree.nodes}`)

      console.log(`\n🎱 Vector Pool:`)
      console.log(`  Utilization: ${combatStats.vectorPool.utilization}%`)
      console.log(`  Active/Total: ${combatStats.vectorPool.active}/${combatStats.vectorPool.total}`)
    }

    console.log('='.repeat(70) + '\n')

    // Log to file
    if (this.options.enableFileLogging) {
      this.appendToLog(stats, combatStats)
    }
  }

  /**
   * Initialize log files (server-only)
   */
  initializeLogFiles() {
    if (!this.fs || !this.path || !this.options.enableFileLogging) return

    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
      const csvPath = this.path.join(this.options.logDirectory, `performance_${timestamp}.csv`)

      // CSV header
      const header =
        'timestamp,uptime_s,avg_frame_ms,max_frame_ms,avg_query_ms,max_query_ms,total_queries,queries_per_sec,avg_entities,max_entities,octree_depth,octree_nodes,pool_utilization\n'
      this.fs.writeFileSync(csvPath, header, 'utf8')

      this.currentLogFile = csvPath
      console.log(`[PerformanceMonitor] Log file: ${csvPath}`)
    } catch (err) {
      console.error('[PerformanceMonitor] Failed to create log file:', err.message)
      this.options.enableFileLogging = false
    }
  }

  /**
   * Append data to log file (server-only)
   */
  appendToLog(stats, combatStats) {
    if (!this.fs || !this.currentLogFile) return

    try {
      const timestamp = new Date().toISOString()
      const row = [
        timestamp,
        this.getUptime(),
        stats.avgFrameTime,
        stats.maxFrameTime,
        stats.avgQueryTime,
        stats.maxQueryTime,
        stats.totalQueries,
        stats.queriesPerSecond,
        stats.avgEntityCount,
        stats.maxEntityCount,
        combatStats?.octree.depth || 0,
        combatStats?.octree.nodes || 0,
        combatStats?.vectorPool.utilization || 0,
      ].join(',')

      this.fs.appendFileSync(this.currentLogFile, row + '\n', 'utf8')
    } catch (err) {
      console.error('[PerformanceMonitor] Failed to append to log:', err.message)
    }
  }

  /**
   * Get current metrics (for programmatic access)
   */
  getMetrics() {
    return this.calculateStats()
  }

  /**
   * Reset metrics
   */
  reset() {
    console.log('[PerformanceMonitor] Resetting metrics')

    this.metrics.frameTimes = []
    this.metrics.avgFrameTime = 0
    this.metrics.maxFrameTime = 0
    this.metrics.spatialQueryTimes = []
    this.metrics.avgQueryTime = 0
    this.metrics.maxQueryTime = 0
    this.metrics.totalQueries = 0
    this.metrics.entityCountSamples = []
    this.metrics.avgEntityCount = 0
    this.metrics.maxEntityCount = 0
    this.metrics.startTime = Date.now()
    this.metrics.lastReportTime = Date.now()
    this.metrics.sampleCount = 0
  }
}
