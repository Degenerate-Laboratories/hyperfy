/**
 * DamageNumbers - Floating Damage Text
 *
 * Simplified version adapted from v34 for v35
 * Shows floating damage numbers above entities when they take damage
 */

import { useEffect, useState } from 'react'
import { CombatEvents } from '../events/CombatEvents'
import { worldToScreen } from '../utils/worldToScreen'

export function DamageNumbers({ world }) {
  const [numbers, setNumbers] = useState([])
  let nextId = 0

  useEffect(() => {
    const onDamage = data => {
      const numberId = nextId++

      // Add new damage number
      setNumbers(prev => [
        ...prev,
        {
          id: numberId,
          targetId: data.targetId,
          damage: data.amount || 0,
          isCritical: data.isCrit || false,
          timestamp: Date.now(),
        },
      ])

      // Auto-remove after 2 seconds
      setTimeout(() => {
        setNumbers(prev => prev.filter(n => n.id !== numberId))
      }, 2000)
    }

    world.events.on(CombatEvents.DAMAGE, onDamage)

    return () => {
      world.events.off(CombatEvents.DAMAGE, onDamage)
    }
  }, [world])

  return (
    <div style={styles.container}>
      {numbers.map(num => (
        <DamageNumber key={num.id} number={num} world={world} />
      ))}
    </div>
  )
}

function DamageNumber({ number, world }) {
  const [position, setPosition] = useState(null)

  useEffect(() => {
    // Get entity position and convert to screen coordinates
    const entity = world.entities.get(number.targetId)
    if (!entity) return

    const updatePosition = () => {
      const entityPos = entity.position?.value
      if (!entityPos) return

      // Convert 3D world position to 2D screen position
      const screenPos = worldToScreen(world, entityPos.x, entityPos.y + 2, entityPos.z)

      if (screenPos) {
        setPosition({
          x: screenPos.x,
          y: screenPos.y,
        })
      }
    }

    // Update position initially and on each frame
    updatePosition()

    const interval = setInterval(updatePosition, 16) // ~60fps
    return () => clearInterval(interval)
  }, [world, number.targetId])

  if (!position) return null

  const elapsed = Date.now() - number.timestamp
  const progress = Math.min(elapsed / 2000, 1) // 2 second duration

  // Calculate opacity (fade out over time)
  const opacity = 1 - progress

  // Calculate vertical offset (float upward)
  const yOffset = -progress * 50 // Float up 50px

  const damageStyle = {
    ...styles.damageNumber,
    left: position.x + 'px',
    top: (position.y + yOffset) + 'px',
    opacity,
    fontSize: number.isCritical ? '32px' : '24px',
    color: number.damage < 0 ? '#22c55e' : number.isCritical ? '#ef4444' : '#fbbf24',
  }

  return (
    <div style={damageStyle}>
      {number.damage < 0 ? `+${Math.abs(number.damage)}` : number.damage}
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 9995,
  },
  damageNumber: {
    position: 'fixed',
    transform: 'translate(-50%, -50%)',
    fontWeight: 700,
    pointerEvents: 'none',
    textShadow: '0 0 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)',
    transition: 'opacity 0.1s linear',
  },
}
