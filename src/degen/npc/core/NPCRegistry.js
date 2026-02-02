/**
 * NPCRegistry - Manages NPC character definitions and templates
 *
 * Loads character definitions from JSON and provides them as spawn templates.
 */
export class NPCRegistry {
  constructor() {
    this.characters = new Map()
    this.ready = false
  }

  /**
   * Load characters from JSON data
   * @param {Object} data - Characters data with { characters: [...] }
   */
  load(data) {
    if (!data || !data.characters) {
      throw new Error('[NPCRegistry] No characters data provided')
    }

    if (!Array.isArray(data.characters)) {
      throw new Error('[NPCRegistry] characters must be an array')
    }

    if (data.characters.length === 0) {
      throw new Error('[NPCRegistry] Cannot load empty characters array')
    }

    // Clear existing
    this.characters.clear()

    // Load characters
    for (const char of data.characters) {
      if (!char.id) {
        throw new Error('[NPCRegistry] Character missing id field')
      }
      if (!char.name) {
        throw new Error(`[NPCRegistry] Character ${char.id} missing name field`)
      }

      this.characters.set(char.id, char)
    }

    if (this.characters.size === 0) {
      throw new Error('[NPCRegistry] No valid characters loaded')
    }

    this.ready = true
    console.log(`[NPCRegistry] ✓ Loaded ${this.characters.size} character(s)`)
  }

  /**
   * Get all characters
   * @returns {Array<Object>} Array of character definitions
   */
  getAll() {
    return Array.from(this.characters.values())
  }

  /**
   * Get character by ID
   * @param {string} id - Character ID
   * @returns {Object|null} Character definition
   */
  get(id) {
    return this.characters.get(id) || null
  }

  /**
   * Check if character exists
   * @param {string} id - Character ID
   * @returns {boolean} True if character exists
   */
  has(id) {
    return this.characters.has(id)
  }

  /**
   * Create NPC spawn config from character definition
   * @param {string} characterId - Character ID from registry
   * @param {Object} overrides - Optional overrides for spawn config
   * @returns {Object} NPC spawn configuration
   */
  createSpawnConfig(characterId, overrides = {}) {
    const character = this.get(characterId)
    if (!character) {
      throw new Error(`Character not found: ${characterId}`)
    }

    // Generate unique NPC ID
    const npcId = overrides.id || `npc-${characterId}-${Date.now()}`

    // Base config from character stats
    const config = {
      id: npcId,
      name: character.name,
      health: character.stats?.health || 100,
      maxHealth: character.stats?.maxHealth || 100,
      spawnPosition: overrides.spawnPosition || [0, 1, 0],
      quaternion: overrides.quaternion || [0, 0, 0, 1],

      // Store character reference
      characterId: character.id,
      characterData: character,

      // Enable default systems
      systems: {
        actions: {
          enabled: true,
        },
        perception: {
          enabled: true,
          radius: character.ai?.aggroRange || 15,
          updateRate: 0.5,
          detectPlayers: true,
          detectMobs: character.ai?.assistAllies || false,
        },
      },

      // Merge overrides
      ...overrides,
    }

    return config
  }

  /**
   * Get character count
   * @returns {number} Number of registered characters
   */
  size() {
    return this.characters.size
  }
}
