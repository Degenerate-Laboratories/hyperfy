import { System } from './System'

/**
 * Server Sound System
 *
 * - Runs on the server
 * - Listens for sound events from entity apps
 * - Broadcasts spatial sound events to all clients
 * - Fail-fast validation ensures proper initialization
 *
 * Event Flow:
 * 1. App calls: app.send('playSound', { sound: 'name', volume: 0.9 })
 * 2. Apps system emits 'entityEvent'
 * 3. ServerSound receives event and looks up entity position
 * 4. Broadcasts to all clients via network.send('playSound', data)
 *
 * Supports two event types:
 * - playSound: Play a specific sound by name
 * - playRandomSound: Pick and play a random sound from a list
 */
export class ServerSound extends System {
  constructor(world) {
    super(world)
    this.isReady = false
    this.eventListeners = []
  }

  /**
   * Initialize the sound system with fail-fast validation
   * Throws errors if required systems are not available
   */
  async init(options) {
    // Fail-fast validation: Check all required systems
    if (!this.world.events) {
      throw new Error('[sound] Events system required')
    }
    if (!this.world.network) {
      throw new Error('[sound] Network system required')
    }
    if (!this.world.apps) {
      throw new Error('[sound] Apps system required')
    }
    if (!this.world.entities) {
      throw new Error('[sound] Entities system required')
    }

    // Register event listeners
    const playListener = this.world.events.on('entityEvent', this.handleEntityEvent)
    this.eventListeners.push(playListener)

    this.isReady = true
    console.log('[sound] Server sound system initialized')
  }

  /**
   * Handle entity events from the apps system
   * Listens for 'playSound' and 'playRandomSound' events
   *
   * @param {Object} socket - Socket that triggered the event (can be null for server-side events)
   * @param {Array} event - [entityId, version, eventName, data]
   */
  handleEntityEvent = (socket, event) => {
    const [entityId, version, eventName, data] = event

    // Only handle sound-related events
    if (eventName === 'playSound') {
      this.broadcastSound(entityId, data, socket?.id)
    } else if (eventName === 'playRandomSound') {
      this.broadcastRandomSound(entityId, data, socket?.id)
    }
  }

  /**
   * Broadcast a sound event to all clients
   *
   * @param {string} entityId - ID of entity playing the sound
   * @param {Object} data - Sound data { sound, volume, spatial }
   * @param {string} ignoreSocketId - Socket to ignore (usually sender)
   */
  broadcastSound(entityId, data, ignoreSocketId = null) {
    // Get entity to retrieve position
    const entity = this.world.entities.get(entityId)
    if (!entity) {
      console.warn(`[sound] Entity ${entityId} not found, cannot play sound`)
      return
    }

    // Get entity position (all entities have position in data)
    const position = entity.data.position
    if (!position) {
      console.warn(`[sound] Entity ${entityId} has no position, cannot play spatial sound`)
      return
    }

    // Prepare sound event payload
    const soundEvent = {
      entityId: entityId,
      sound: data.sound,
      volume: data.volume !== undefined ? data.volume : 1.0,
      spatial: data.spatial !== undefined ? data.spatial : true,
      position: {
        x: position[0],
        y: position[1],
        z: position[2],
      },
    }

    // Broadcast to all clients except the sender
    this.world.network.send('playSound', soundEvent, ignoreSocketId)
  }

  /**
   * Pick a random sound from a list and broadcast it
   *
   * @param {string} entityId - ID of entity playing the sound
   * @param {Object} data - { sounds: [...], volume, spatial }
   * @param {string} ignoreSocketId - Socket to ignore
   */
  broadcastRandomSound(entityId, data, ignoreSocketId = null) {
    if (!data.sounds || !Array.isArray(data.sounds) || data.sounds.length === 0) {
      console.warn(`[sound] playRandomSound requires non-empty sounds array`)
      return
    }

    // Pick a random sound from the list
    const randomSound = data.sounds[Math.floor(Math.random() * data.sounds.length)]

    // Create modified data with the selected sound
    const soundData = {
      sound: randomSound,
      volume: data.volume,
      spatial: data.spatial,
    }

    // Broadcast using the regular sound method
    this.broadcastSound(entityId, soundData, ignoreSocketId)
  }

  /**
   * Cleanup on system destruction
   */
  destroy() {
    // Remove event listeners
    this.eventListeners.forEach(listener => {
      if (listener && typeof listener.off === 'function') {
        listener.off()
      }
    })
    this.eventListeners = []
    this.isReady = false
  }
}
