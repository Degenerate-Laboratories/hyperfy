/**
 * UpdateThrottler - Distance-based AI update frequency optimizer
 *
 * Purpose: Reduce AI update frequency for distant entities to save CPU cycles.
 * Entities closer to players update more frequently, distant ones update less.
 *
 * Performance Impact (100 entities):
 *   - Close (0-10m):  10 entities × 50Hz = 500 updates/sec
 *   - Medium (10-25m): 30 entities × 20Hz = 600 updates/sec
 *   - Far (25-50m):    40 entities × 10Hz = 400 updates/sec
 *   - Very far (50-100m): 20 entities × 5Hz = 100 updates/sec
 *   Total: 1,600 updates/sec vs 5,000 (68% reduction)
 *
 * Usage:
 *   const throttler = new UpdateThrottler()
 *   if (throttler.shouldUpdate(entityId, distanceToPlayer)) {
 *     // Run AI logic
 *   }
 */
export class UpdateThrottler {
  constructor() {
    // Distance-based update tiers
    // Format: { maxDistance, hz, interval (in frames at 50Hz) }
    this.tiers = [
      { maxDistance: 10, hz: 50, interval: 1 }, // Close: every frame
      { maxDistance: 25, hz: 20, interval: 2.5 }, // Medium: every 2.5 frames
      { maxDistance: 50, hz: 10, interval: 5 }, // Far: every 5 frames
      { maxDistance: 100, hz: 5, interval: 10 }, // Very far: every 10 frames
    ]

    // Track per-entity update state
    // entityId → { frameCount, lastUpdate }
    this.entityStates = new Map()

    // Global frame counter (incremented each fixedUpdate)
    this.globalFrameCount = 0
  }

  /**
   * Check if entity should update this frame
   * @param {string} entityId - Entity ID
   * @param {number} distanceToNearestPlayer - Distance to closest player
   * @returns {boolean} True if entity should update
   */
  shouldUpdate(entityId, distanceToNearestPlayer) {
    // Get or create entity state
    let state = this.entityStates.get(entityId)
    if (!state) {
      state = { frameCount: 0, lastUpdate: 0 }
      this.entityStates.set(entityId, state)
    }

    state.frameCount++

    // Find appropriate tier based on distance
    const tier = this.tiers.find(t => distanceToNearestPlayer <= t.maxDistance) || this.tiers[this.tiers.length - 1]

    // Check if enough frames have passed
    const framesSinceUpdate = state.frameCount - state.lastUpdate
    if (framesSinceUpdate >= tier.interval) {
      state.lastUpdate = state.frameCount
      return true
    }

    return false
  }

  /**
   * Cleanup entity state when removed
   * @param {string} entityId - Entity ID to cleanup
   */
  cleanup(entityId) {
    this.entityStates.delete(entityId)
  }

  /**
   * Get current update tier for an entity
   * @param {number} distanceToNearestPlayer - Distance to closest player
   * @returns {Object} Tier info { maxDistance, hz, interval }
   */
  getTier(distanceToNearestPlayer) {
    return this.tiers.find(t => distanceToNearestPlayer <= t.maxDistance) || this.tiers[this.tiers.length - 1]
  }

  /**
   * Get statistics about throttling effectiveness
   * @returns {{totalEntities: number, avgInterval: number, tiers: Array}}
   */
  getStats() {
    const tierCounts = this.tiers.map(() => 0)
    let totalInterval = 0

    this.entityStates.forEach((state, entityId) => {
      // Would need distance info here - simplified for now
      totalInterval += state.frameCount - state.lastUpdate
    })

    return {
      totalEntities: this.entityStates.size,
      avgInterval: this.entityStates.size > 0 ? totalInterval / this.entityStates.size : 0,
      tiers: this.tiers.map((tier, i) => ({
        ...tier,
        count: tierCounts[i],
      })),
    }
  }

  /**
   * Log throttler statistics (for debugging)
   */
  logStats() {
    const stats = this.getStats()
    console.log(`[UpdateThrottler] Entities: ${stats.totalEntities}, Avg interval: ${stats.avgInterval.toFixed(1)} frames`)
  }
}
