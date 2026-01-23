/**
 * CombatEvents - Combat Event Constants
 *
 * Extracted from v34's EventRegistry.js
 * Single source of truth for combat event names
 *
 * Usage:
 *   import { CombatEvents } from './events/CombatEvents'
 *   world.events.on(CombatEvents.DAMAGE, handler)
 */

/**
 * Combat Events - Events emitted during combat interactions
 * These events are emitted on world.events for local game state
 */
export const CombatEvents = {
  DAMAGE: 'combat:damage',
  DEATH: 'combat:death',
  HEAL: 'combat:heal',
  ABILITY_USED: 'combat:abilityUsed',
  ABILITY_ACTIVATE: 'combat:ability-activate',
  ATTACK_START: 'combat:attackStart',
  ATTACK_END: 'combat:attackEnd',
  CRITICAL_HIT: 'combat:criticalHit',
  MISS: 'combat:miss',
  TARGET: 'combat:target',
  TARGET_CHANGED: 'combat:target-changed',
}

/**
 * Entity Events - Events related to entity health and state
 */
export const EntityEvents = {
  HEALTH_CHANGED: 'entity:health',
  SPAWNED: 'entity:spawned',
  DESPAWNED: 'entity:despawned',
  POSITION_CHANGED: 'entity:position',
  STATE_CHANGED: 'entity:state',
}

/**
 * Get all combat-related event names
 * @returns {string[]} Array of all combat event names
 */
export function getAllCombatEvents() {
  return [...Object.values(CombatEvents), ...Object.values(EntityEvents)]
}

/**
 * Check if event name is a combat event
 * @param {string} eventName - Event name to check
 * @returns {boolean} True if event name is a combat event
 */
export function isCombatEvent(eventName) {
  return getAllCombatEvents().includes(eventName)
}
