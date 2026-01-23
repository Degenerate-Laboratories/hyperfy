/**
 * DegenQuest Combat UI System - Main Exports
 *
 * Clean module boundary for v35 combat UI integration
 * Self-contained module that can be cleanly removed or disabled
 */

// Systems
export { CombatSystem } from './systems/CombatSystem.js'
export { TargetingSystem } from './systems/TargetingSystem.js'

// UI Components
export { CombatUI } from './CombatUI.jsx'
export { CombatLog } from './components/CombatLog.jsx'
export { HealthBars } from './components/HealthBars.jsx'
export { DamageNumbers } from './components/DamageNumbers.jsx'
export { AbilityBar } from './components/AbilityBar.jsx'

// Events
export * from './events/CombatEvents.js'

// Core Components (for advanced usage)
export { default as CombatComponent } from './core/CombatComponent.js'
export { default as TargetingComponent } from './core/TargetingComponent.js'
export { default as AbilityComponent } from './core/AbilityComponent.js'

// Test Helpers (browser console)
export { registerTestHelpers } from './utils/testHelpers.js'

// Feature flag for easy enable/disable
export const COMBAT_ENABLED = true

/**
 * Register combat systems with world
 * @param {Object} world - World instance
 */
export function registerCombatSystems(world) {
  if (!COMBAT_ENABLED) {
    console.log('[Combat] Combat UI disabled via feature flag')
    return
  }

  console.log('[Combat] Registering combat systems...')

  // Register systems
  world.register('combat', CombatSystem)
  world.register('targeting', TargetingSystem)

  console.log('[Combat] Combat systems registered')
}
