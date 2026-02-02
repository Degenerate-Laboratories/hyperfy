import fs from 'fs-extra'
import path from 'path'

/**
 * NPCs Loader
 *
 * Loads NPC character definitions from npcs.json manifest
 * Each NPC has its own directory with character.json
 * Similar to mobs loader pattern
 */
class NPCs {
  constructor() {
    this.characters = []
    this.behaviors = new Map()  // Store behavior modules
    this.ready = false
  }

  async init({ rootDir, worldDir }) {
    console.log('[npcs] initializing')
    this.dir = path.join(worldDir, '/npcs')

    try {
      // Ensure npcs directory exists
      await fs.ensureDir(this.dir)

      // Copy over built-in NPCs
      const srcNpcsDir = path.join(rootDir, 'src/world/npcs')
      if (await fs.pathExists(srcNpcsDir)) {
        await fs.copy(srcNpcsDir, this.dir)
      }

      // Check if manifest exists
      const manifestPath = path.join(this.dir, 'npcs.json')
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('CRITICAL: npcs.json not found - NPCs are required')
      }

      // Load and validate manifest
      const manifest = await fs.readJson(manifestPath)
      if (!manifest.npcs || !Array.isArray(manifest.npcs)) {
        throw new Error('Invalid npcs.json: npcs array missing')
      }

      if (manifest.npcs.length === 0) {
        throw new Error('CRITICAL: No NPCs defined in manifest - at least 1 NPC required')
      }

      console.log(`[npcs] Loading ${manifest.npcs.length} NPC(s) from manifest...`)

      // Load each NPC directory from manifest
      for (const npcDirName of manifest.npcs) {
        console.log(`[npcs] Loading ${npcDirName}...`)

        const npcPath = path.join(this.dir, npcDirName)
        if (!await fs.pathExists(npcPath)) {
          throw new Error(`NPC directory not found: ${npcDirName}`)
        }

        const characterPath = path.join(npcPath, 'character.json')
        if (!await fs.pathExists(characterPath)) {
          throw new Error(`character.json not found in: ${npcDirName}`)
        }

        try {
          // Load character definition
          const character = await fs.readJson(characterPath)

          // Validate character
          this.validateCharacter(character, npcDirName)

          // Load behavior script if specified
          if (character.behavior?.script) {
            const behaviorPath = path.join(npcPath, character.behavior.script)
            if (await fs.pathExists(behaviorPath)) {
              // Dynamic import behavior module
              const behaviorModule = await import(`file://${behaviorPath}`)
              if (!behaviorModule.default) {
                throw new Error(`Behavior module has no default export: ${character.id}`)
              }
              this.behaviors.set(character.id, behaviorModule.default)
              console.log(`[npcs] ✓ loaded behavior: ${character.id}`)
            } else {
              throw new Error(`Behavior script not found: ${character.behavior.script} for ${character.id}`)
            }
          }

          // Store with directory reference and full path
          character._directory = npcDirName
          character._npcPath = npcPath  // Full path for assets
          this.characters.push(character)

          console.log(`[npcs] ✓ loaded: ${character.name}`)
        } catch (error) {
          throw new Error(`Failed to load ${npcDirName}: ${error.message}`)
        }
      }

      this.ready = true
      console.log(`[npcs] ✓ loaded ${this.characters.length} NPC(s)`)

      // Validation passed
      return this

    } catch (error) {
      console.error('[npcs] FATAL ERROR:', error.message)
      throw error  // Propagate to bootstrap
    }
  }

  validateCharacter(character, dirName) {
    // Validate character structure
    if (!character) {
      throw new Error('Invalid character: missing data')
    }
    if (!character.id) {
      throw new Error('Character missing id')
    }
    if (!character.name) {
      throw new Error(`Character missing name: ${character.id}`)
    }
    if (!character.model) {
      throw new Error(`Character missing model: ${character.name}`)
    }
    if (!character.stats) {
      throw new Error(`Character missing stats: ${character.name}`)
    }
  }

  /**
   * Get behavior module for a character
   * @param {string} characterId - Character ID
   * @returns {Object|undefined} Behavior module or undefined if not found
   */
  getBehavior(characterId) {
    return this.behaviors.get(characterId)
  }
}

export const npcs = new NPCs()
