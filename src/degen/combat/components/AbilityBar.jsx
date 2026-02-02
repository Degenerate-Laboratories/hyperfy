/**
 * AbilityBar - 8-Slot Spell Bar with Cooldowns
 *
 * Simplified version adapted from v34 for v35
 * Shows ability bar at bottom with keybinds and cooldown visualization
 */

import { useEffect, useState } from 'react'
import { CombatEvents } from '../events/CombatEvents'

// Default abilities (placeholder - will be replaced by actual game abilities)
const DEFAULT_ABILITIES = [
  {
    id: 'attack',
    name: 'Attack',
    icon: '⚔️',
    keybind: '1',
    cooldown: 1000,
    description: 'Basic attack',
  },
  {
    id: 'fireball',
    name: 'Fireball',
    icon: '🔥',
    keybind: '2',
    cooldown: 3000,
    description: 'Fire damage',
  },
  {
    id: 'heal',
    name: 'Heal',
    icon: '💚',
    keybind: '3',
    cooldown: 5000,
    description: 'Restore health',
  },
  null, // Empty slot
  null,
  null,
  null,
  null,
]

export function AbilityBar({ world }) {
  const [abilities, setAbilities] = useState(DEFAULT_ABILITIES)
  const [cooldowns, setCooldowns] = useState({})

  // Debug: Listen for our own event to verify it's being emitted
  useEffect(() => {
    const handler = (data) => {
      console.log('[AbilityBar] ✓ Event confirmed emitted:', data)
    }
    world.events.on(CombatEvents.ABILITY_ACTIVATE, handler)
    return () => world.events.off(CombatEvents.ABILITY_ACTIVATE, handler)
  }, [world])

  const useAbility = (ability, index) => {
    console.log('[AbilityBar] useAbility called', { ability, index })

    if (!ability) {
      console.log('[AbilityBar] No ability in slot')
      return
    }
    if (cooldowns[ability.id]) {
      console.log('[AbilityBar] Ability on cooldown:', ability.id)
      return // On cooldown
    }

    const playerId = world.entities.player?.data?.id
    console.log('[AbilityBar] Player ID:', playerId)

    // Send to server via network packet
    const eventData = {
      entityId: playerId,
      abilityId: ability.id,
      slotIndex: index,
      timestamp: Date.now(),
    }
    console.log('[AbilityBar] Sending abilityActivate packet to server:', eventData)
    world.network.send('abilityActivate', eventData)

    // Also emit local event for client-side feedback
    console.log('[AbilityBar] Emitting local ABILITY_ACTIVATE event')
    world.events.emit(CombatEvents.ABILITY_ACTIVATE, eventData)

    // Start local cooldown timer
    if (ability.cooldown) {
      const startTime = Date.now()
      setCooldowns(prev => ({
        ...prev,
        [ability.id]: {
          remaining: ability.cooldown,
          total: ability.cooldown,
          startTime,
        },
      }))

      // Update cooldown countdown
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, ability.cooldown - elapsed)

        if (remaining === 0) {
          clearInterval(interval)
          setCooldowns(prev => {
            const updated = { ...prev }
            delete updated[ability.id]
            return updated
          })
        } else {
          setCooldowns(prev => ({
            ...prev,
            [ability.id]: {
              remaining,
              total: ability.cooldown,
              startTime,
            },
          }))
        }
      }, 50) // Update every 50ms
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyPress = e => {
      console.log('[AbilityBar] Key pressed:', e.key, 'Target:', e.target.tagName)

      // Don't trigger if typing in chat
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        console.log('[AbilityBar] Ignoring - typing in input field')
        return
      }

      const key = e.key
      const abilityIndex = abilities.findIndex(
        a => a && (a.keybind === key || a.keybind === key.toUpperCase())
      )

      console.log('[AbilityBar] Ability index found:', abilityIndex)

      if (abilityIndex !== -1) {
        e.preventDefault()
        console.log('[AbilityBar] Triggering ability at index:', abilityIndex)
        useAbility(abilities[abilityIndex], abilityIndex)
      }
    }

    window.addEventListener('keypress', onKeyPress)
    return () => window.removeEventListener('keypress', onKeyPress)
  }, [abilities, cooldowns])

  return (
    <div style={styles.abilityBar}>
      {abilities.map((ability, index) => {
        const cooldown = ability ? cooldowns[ability.id] : null
        const cooldownPercent = cooldown ? ((cooldown.total - cooldown.remaining) / cooldown.total) * 100 : 0

        return (
          <div
            key={index}
            style={{
              ...styles.abilitySlot,
              ...(ability ? {} : styles.emptySlot),
              ...(cooldown ? styles.onCooldown : {}),
            }}
            onClick={() => useAbility(ability, index)}
            title={ability ? `${ability.name}\n${ability.description}` : 'Empty Slot'}
          >
            {ability && (
              <>
                <div style={styles.abilityIcon}>{ability.icon}</div>
                <div style={styles.abilityKeybind}>{ability.keybind}</div>
                {cooldown && (
                  <>
                    <div style={{...styles.cooldownOverlay, opacity: 1 - (cooldownPercent / 100)}} />
                    <div style={styles.cooldownText}>
                      {Math.ceil(cooldown.remaining / 1000)}s
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  abilityBar: {
    position: 'fixed',
    bottom: 'calc(6rem + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    pointerEvents: 'auto',
    zIndex: 9997,
  },
  abilitySlot: {
    width: '56px',
    height: '56px',
    background: 'rgba(11, 10, 21, 0.9)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
  },
  emptySlot: {
    opacity: 0.3,
    cursor: 'default',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  onCooldown: {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  abilityIcon: {
    fontSize: '28px',
    lineHeight: 1,
  },
  abilityKeybind: {
    position: 'absolute',
    bottom: '2px',
    right: '4px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  cooldownOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '6px',
    pointerEvents: 'none',
  },
  cooldownText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
    pointerEvents: 'none',
  },
}
