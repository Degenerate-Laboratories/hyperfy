/**
 * EventBus - Simple event system for NPC lifecycle events
 *
 * Events:
 * - NPC_SPAWNED: { npcId }
 * - NPC_DESTROYED: { npcId }
 * - NPC_ACTION_START: { npcId, action }
 * - NPC_ACTION_COMPLETE: { npcId, action }
 * - NPC_PERCEPTION_UPDATE: { npcId, entities }
 */
export class EventBus {
  constructor() {
    this.listeners = new Map()
  }

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return
    this.listeners.get(event).delete(callback)
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data)
      } catch (error) {
        console.error(`[EventBus] Error in ${event} listener:`, error)
      }
    }
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear()
  }

  /**
   * Get listener count for event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).size : 0
  }
}
