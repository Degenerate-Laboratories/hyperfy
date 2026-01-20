/**
 * Sound Module Registry
 *
 * Central registry for all game sound modules.
 * Auto-discovers and registers modules with SoundManager.
 *
 * To add a new sound category:
 * 1. Create a new module extending SoundModule
 * 2. Add it to the imports below
 * 3. Add it to the MODULES array
 * 4. Done! No other changes needed.
 *
 * Usage in client:
 * import { initializeSounds } from '../world/sounds'
 * initializeSounds(world)
 */

import { FootstepsModule } from './FootstepsModule'
import { AmbientModule } from './AmbientModule'
import { UIModule } from './UIModule'

/**
 * Registry of all sound modules
 * Add new modules here to auto-register them
 */
const MODULES = [
  { name: 'footsteps', module: FootstepsModule },
  { name: 'ambient', module: AmbientModule },
  { name: 'ui', module: UIModule },
  // Add more modules here as you create them:
  // { name: 'combat', module: CombatModule },
  // { name: 'magic', module: MagicModule },
  // { name: 'vehicles', module: VehiclesModule },
]

/**
 * Initialize all sound modules
 * Call this once during world initialization
 *
 * @param {World} world - World instance
 * @returns {SoundManager} The sound manager instance
 */
export function initializeSounds(world) {
  if (!world.sounds) {
    console.error('[sounds] SoundManager not available on world')
    return null
  }

  console.log('[sounds] Registering sound modules...')

  // Register all modules
  for (const { name, module: ModuleClass } of MODULES) {
    try {
      const instance = new ModuleClass()
      world.sounds.registerModule(name, instance)
    } catch (err) {
      console.error(`[sounds] Failed to register module '${name}':`, err)
    }
  }

  const totalSounds = world.sounds.listAllSounds().length
  console.log(`[sounds] ✓ All modules registered (${totalSounds} total sounds)`)

  return world.sounds
}

/**
 * Get a specific module instance
 * @param {World} world - World instance
 * @param {string} moduleName - Module name (e.g., 'footsteps')
 * @returns {SoundModule|null}
 */
export function getSoundModule(world, moduleName) {
  return world.sounds?.modules.get(moduleName) || null
}

// Export modules for direct access if needed
export { FootstepsModule, AmbientModule, UIModule }
