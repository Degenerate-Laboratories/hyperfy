/**
 * Client-side Combat System - Simplified Version
 * 
 * Only includes UI components and basic client functionality
 * Avoids problematic server/targeting imports that break build
 */

import { CombatSystem } from './systems/CombatSystem.js'

// Export only what's safe for client
export { CombatSystem }

// UI Components (client-side safe)
export { CombatUI } from './CombatUI.jsx'
export { CombatLog } from './components/CombatLog.jsx'
export { HealthBars } from './components/HealthBars.jsx'

// Events
export * from './events/CombatEvents.js'

// Core Components  
export { default as CombatComponent } from './core/CombatComponent.js'