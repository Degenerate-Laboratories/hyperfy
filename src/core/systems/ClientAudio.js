import * as THREE from '../extras/three'

import { System } from './System'

const up = new THREE.Vector3(0, 1, 0)
const v1 = new THREE.Vector3()

export class ClientAudio extends System {
  constructor(world) {
    super(world)
    this.handles = new Set()
    this.ctx = new AudioContext() // new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain()
    this.masterGain.connect(this.ctx.destination)
    this.groupGains = {
      music: this.ctx.createGain(),
      sfx: this.ctx.createGain(),
      voice: this.ctx.createGain(),
    }
    this.groupGains.music.gain.value = world.prefs.music
    this.groupGains.sfx.gain.value = world.prefs.sfx
    this.groupGains.voice.gain.value = world.prefs.voice
    this.groupGains.music.connect(this.masterGain)
    this.groupGains.sfx.connect(this.masterGain)
    this.groupGains.voice.connect(this.masterGain)

    this.listener = this.ctx.listener
    if (!this.listener.positionX) {
      this.listener.setPosition(0, 0, 0);
      this.listener.setOrientation(0, 0, -1, 0, 1, 0);
    } else {
      this.listener.positionX.value = 0
      this.listener.positionY.value = 0
      this.listener.positionZ.value = 0
      this.listener.forwardX.value = 0
      this.listener.forwardY.value = 0
      this.listener.forwardZ.value = -1
      this.listener.upX.value = 0
      this.listener.upY.value = 1
      this.listener.upZ.value = 0
    }

    this.lastDelta = 0

    this.queue = []
    this.unlocked = this.ctx.state !== 'suspended'
    if (!this.unlocked) {
      this.setupUnlockListener()
    }

    // Sound pool management (entity -> [audio nodes])
    this.soundPool = new Map()
    this.maxPoolSize = 3 // Max 3 simultaneous sounds per entity
  }

  ready(fn) {
    if (this.unlocked) return fn()
    this.queue.push(fn)
  }

  setupUnlockListener() {
    const complete = () => {
      this.unlocked = true
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('keydown', unlock)
      while (this.queue.length) {
        this.queue.pop()()
      }
      console.log('[audio] unlocked')
    }
    const unlock = async () => {
      try {
        await this.ctx.resume()
        if (this.ctx.state !== 'running') throw new Error('Audio still suspended')
        const video = document.createElement('video')
        video.playsInline = true
        video.muted = true
        video.src = '/tiny.mp4'
        video
          .play()
          .then(() => {
            video.pause()
            video.remove()
            console.log('[audio] video played')
          })
          .catch(err => {
            console.log('[audio] video failed')
          })
      } catch (err) {
        console.error(err)
      } finally {
        // either way, mark the system as unlocked
        complete()
      }
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    document.addEventListener('keydown', unlock)
    console.log('[audio] suspended, waiting for interact...')
  }

  async init() {
    this.world.prefs.on('change', this.onPrefsChange)

    // Fail-fast validation
    if (!this.ctx) {
      throw new Error('[audio] AudioContext not available')
    }
    if (!this.groupGains.sfx) {
      throw new Error('[audio] SFX group not initialized')
    }
    if (!this.listener) {
      throw new Error('[audio] Audio listener not configured')
    }

    // Register network event handler for sound playback
    if (this.world.network) {
      this.world.network.on('playSound', this.handlePlaySound)
    }

    console.log('[audio] Client audio system initialized')
  }

  start() {
    // ...
  }

  lateUpdate(delta) {
    const target = this.world.rig
    const dir = v1.set(0, 0, -1).applyQuaternion(target.quaternion)
    if (this.listener.positionX) {
      // https://github.com/mrdoob/three.js/blob/master/src/audio/AudioListener.js
      // code path for Chrome (see three#14393)
      const endTime = this.ctx.currentTime + delta * 2
      this.listener.positionX.linearRampToValueAtTime(target.position.x, endTime)
      this.listener.positionY.linearRampToValueAtTime(target.position.y, endTime)
      this.listener.positionZ.linearRampToValueAtTime(target.position.z, endTime)
      this.listener.forwardX.linearRampToValueAtTime(dir.x, endTime)
      this.listener.forwardY.linearRampToValueAtTime(dir.y, endTime)
      this.listener.forwardZ.linearRampToValueAtTime(dir.z, endTime)
      this.listener.upX.linearRampToValueAtTime(up.x, endTime)
      this.listener.upY.linearRampToValueAtTime(up.y, endTime)
      this.listener.upZ.linearRampToValueAtTime(up.z, endTime)
    } else {
      this.listener.setPosition(target.position.x, target.position.y, target.position.z)
      this.listener.setOrientation(dir.x, dir.y, dir.z, up.x, up.y, up.z)
    }
    this.lastDelta = delta * 2
  }

  onPrefsChange = changes => {
    if (changes.music) {
      this.groupGains.music.gain.value = changes.music.value
    }
    if (changes.sfx) {
      this.groupGains.sfx.gain.value = changes.sfx.value
    }
    if (changes.voice) {
      this.groupGains.voice.gain.value = changes.voice.value
    }
  }

  /**
   * Handle network playSound events
   * Creates spatial or non-spatial audio based on event data
   *
   * @param {Object} data - { entityId, sound, volume, spatial, position }
   */
  handlePlaySound = async data => {
    const { entityId, sound, volume, spatial, position } = data

    // Get entity (if it exists locally)
    const entity = this.world.entities?.get(entityId)
    if (!entity) {
      console.warn(`[audio] Entity ${entityId} not found for sound playback`)
      return
    }

    // Resolve sound URL (check mob soundMap first, then world.settings.sounds)
    const soundUrl = this.resolveSoundUrl(entity, sound)
    if (!soundUrl) {
      console.warn(`[audio] Sound '${sound}' not found for entity ${entityId}`)
      return
    }

    // Create and play audio node
    this.playSpatialSound(entityId, soundUrl, volume, spatial, position)
  }

  /**
   * Resolve sound URL from entity blueprint or world settings
   *
   * Priority:
   * 1. Check entity.blueprint.props.soundMap (embedded mob sounds)
   * 2. Check world.settings.sounds (hosted character sounds)
   * 3. Return null if not found
   *
   * @param {Object} entity - Entity object
   * @param {string} soundName - Name of sound to resolve
   * @returns {string|null} Resolved URL or null
   */
  resolveSoundUrl(entity, soundName) {
    // 1. Check mob blueprint soundMap (embedded sounds with asset:// URLs)
    const soundMap = entity.blueprint?.props?.soundMap
    if (soundMap && soundMap[soundName]) {
      return this.world.resolveURL(soundMap[soundName]) // asset:// -> https://
    }

    // 2. Check world settings (hosted sounds for characters)
    const worldSounds = this.world.settings?.sounds
    if (worldSounds && worldSounds[soundName]) {
      return this.world.resolveURL(worldSounds[soundName])
    }

    // 3. Not found
    return null
  }

  /**
   * Play a spatial sound with pooling
   * Manages audio node pool per entity (max 3 simultaneous sounds)
   *
   * @param {string} entityId - Entity ID
   * @param {string} soundUrl - Resolved sound URL
   * @param {number} volume - Volume (0-1)
   * @param {boolean} spatial - Use spatial audio
   * @param {Object} position - { x, y, z }
   */
  async playSpatialSound(entityId, soundUrl, volume = 1.0, spatial = true, position = { x: 0, y: 0, z: 0 }) {
    // Wait for audio unlock (user interaction required by browsers)
    if (!this.unlocked) {
      console.log('[audio] Waiting for user interaction to unlock audio...')
      return
    }

    try {
      // Get or create pool for this entity
      if (!this.soundPool.has(entityId)) {
        this.soundPool.set(entityId, [])
      }
      const pool = this.soundPool.get(entityId)

      // If pool is full, stop oldest sound (FIFO eviction)
      if (pool.length >= this.maxPoolSize) {
        const oldestNode = pool.shift()
        this.stopAudioNode(oldestNode)
      }

      // Load audio buffer
      const loader = this.world.loader
      let buffer
      try {
        buffer = loader.get('audio', soundUrl)
        if (!buffer) {
          buffer = await loader.load('audio', soundUrl)
        }
      } catch (err) {
        console.error(`[audio] Failed to load sound: ${soundUrl}`, err)
        return
      }

      // Create audio node
      const source = this.ctx.createBufferSource()
      source.buffer = buffer

      const gainNode = this.ctx.createGain()
      gainNode.gain.value = volume

      let pannerNode = null
      if (spatial) {
        // Create spatial audio with panner
        pannerNode = this.ctx.createPanner()
        pannerNode.panningModel = 'HRTF'
        pannerNode.distanceModel = 'inverse'
        pannerNode.refDistance = 1
        pannerNode.maxDistance = 40
        pannerNode.rolloffFactor = 3

        // Set position
        if (pannerNode.positionX) {
          const endTime = this.ctx.currentTime + this.lastDelta
          pannerNode.positionX.linearRampToValueAtTime(position.x, endTime)
          pannerNode.positionY.linearRampToValueAtTime(position.y, endTime)
          pannerNode.positionZ.linearRampToValueAtTime(position.z, endTime)
        } else {
          pannerNode.setPosition(position.x, position.y, position.z)
        }

        source.connect(gainNode)
        gainNode.connect(pannerNode)
        pannerNode.connect(this.groupGains.sfx)
      } else {
        // Non-spatial audio
        source.connect(gainNode)
        gainNode.connect(this.groupGains.sfx)
      }

      // Track node in pool
      const audioNode = { source, gainNode, pannerNode, entityId }
      pool.push(audioNode)

      // Auto-cleanup when sound finishes
      source.onended = () => {
        this.stopAudioNode(audioNode)
        const index = pool.indexOf(audioNode)
        if (index !== -1) {
          pool.splice(index, 1)
        }
      }

      // Start playback
      source.start(0)
    } catch (err) {
      console.error('[audio] Error playing sound:', err)
    }
  }

  /**
   * Stop and disconnect an audio node
   * @param {Object} audioNode - { source, gainNode, pannerNode }
   */
  stopAudioNode(audioNode) {
    try {
      if (audioNode.source) {
        audioNode.source.onended = null
        audioNode.source.stop()
      }
      if (audioNode.gainNode) {
        audioNode.gainNode.disconnect()
      }
      if (audioNode.pannerNode) {
        audioNode.pannerNode.disconnect()
      }
    } catch (err) {
      // Already stopped/disconnected, ignore
    }
  }

  destroy() {
    // Clean up sound pool
    this.soundPool.forEach(pool => {
      pool.forEach(audioNode => this.stopAudioNode(audioNode))
    })
    this.soundPool.clear()

    // Clean up existing audio system
    this.groupGains.music.disconnect()
    this.groupGains.sfx.disconnect()
    this.groupGains.voice.disconnect()
    this.masterGain.disconnect()
    this.ctx.close()
    this.handles.clear()
    this.queue = []
  }
}
