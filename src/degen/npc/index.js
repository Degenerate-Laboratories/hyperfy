/**
 * NPC System - Public API
 *
 * Hybrid NPC system combining v34's clean orchestration with v35's native infrastructure.
 * Provides dual API access: high-level Systems API + low-level degen proxy.
 */

// Core components
export { NPCEngine } from './core/NPCEngine'
export { NPC } from './core/NPC'
export { NPCRegistry } from './core/NPCRegistry'
export { EventBus } from './core/events/EventBus'

// Adapters
export { HyperfyAdapter } from './adapters/HyperfyAdapter'

// Systems
export { ActionSystem } from './systems/ActionSystem'
export { PerceptionSystem } from './systems/PerceptionSystem'

// Plugins
export { CommandPlugin } from './plugins/CommandPlugin'

// Examples
export { GuardConfig, AdvancedGuardConfig, setupGuardBehavior } from './examples/guard'
export { MerchantConfig, setupMerchantBehavior } from './examples/merchant'
