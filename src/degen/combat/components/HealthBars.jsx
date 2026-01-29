/**
 * HealthBars - WoW-style Health Bars and Nameplates
 *
 * Shows:
 * - Player health bar (top right)
 * - Target health bar (top center)
 * - Floating NPC nameplates
 */

import { useEffect, useState } from 'react'
import { CombatEvents, EntityEvents } from '../events/CombatEvents'
import { worldToScreen } from '../utils/worldToScreen'

export function HealthBars({ world }) {
  const [bars, setBars] = useState(new Map())
  const [target, setTarget] = useState(null)
  const [player, setPlayer] = useState(null)
  const [playerHealth, setPlayerHealth] = useState({ current: 100, max: 100 })

  // Initialize player
  useEffect(() => {
    const playerEntity = world.entities.player
    if (playerEntity) {
      setPlayer(playerEntity)

      // Initialize player health
      const playerId = playerEntity.data?.id
      if (playerId) {
        const maxHealth = playerEntity.data?.maxHealth || 100
        const currentHealth = playerEntity.data?.health ?? maxHealth

        setPlayerHealth({ current: currentHealth, max: maxHealth })

        // Add player to bars
        setBars(prev => {
          const next = new Map(prev)
          next.set(playerId, {
            entityId: playerId,
            currentHealth,
            maxHealth,
            visible: true,
          })
          return next
        })
      }
    }
  }, [world])

  // Listen for combat events to update health bars
  useEffect(() => {
    const onHealthChanged = data => {
      // Update player health if it's the player
      if (player && data.entityId === player.data?.id) {
        setPlayerHealth({
          current: data.newHealth,
          max: data.maxHealth || playerHealth.max
        })
      }

      // Update bars map
      setBars(prev => {
        const next = new Map(prev)
        const bar = next.get(data.entityId)

        if (bar) {
          next.set(data.entityId, {
            ...bar,
            currentHealth: data.newHealth,
            maxHealth: data.maxHealth || bar.maxHealth,
          })
        } else {
          // Create bar if it doesn't exist
          const entity = world.entities.get(data.entityId)
          if (entity) {
            next.set(data.entityId, {
              entityId: data.entityId,
              currentHealth: data.newHealth,
              maxHealth: data.maxHealth || 100,
              visible: true,
            })
          }
        }

        return next
      })
    }

    const onTargetChanged = data => {
      setTarget(data.target)

      // Ensure target has a health bar entry
      if (data.target?.data?.id) {
        const targetId = data.target.data.id
        setBars(prev => {
          const next = new Map(prev)
          if (!next.has(targetId)) {
            next.set(targetId, {
              entityId: targetId,
              currentHealth: data.target.data?.health ?? data.maxHealth ?? 100,
              maxHealth: data.maxHealth || data.target.data?.maxHealth || 100,
              visible: true,
            })
          }
          return next
        })
      }
    }

    const onEntityAdded = entity => {
      // Create health bar for new entity if it has health
      if (entity?.data?.maxHealth) {
        setBars(prev => {
          const next = new Map(prev)
          next.set(entity.data.id, {
            entityId: entity.data.id,
            currentHealth: entity.data.health || entity.data.maxHealth,
            maxHealth: entity.data.maxHealth,
            visible: true,
          })
          return next
        })
      }
    }

    const onEntityRemoved = entity => {
      if (!entity?.data?.id) return

      setBars(prev => {
        const next = new Map(prev)
        next.delete(entity.data.id)
        return next
      })

      // Clear target if removed
      if (target?.data?.id === entity.data.id) {
        setTarget(null)
      }
    }

    world.events.on(EntityEvents.HEALTH_CHANGED, onHealthChanged)
    world.events.on(CombatEvents.TARGET_CHANGED, onTargetChanged)
    world.entities.on('added', onEntityAdded)
    world.entities.on('removed', onEntityRemoved)

    return () => {
      world.events.off(EntityEvents.HEALTH_CHANGED, onHealthChanged)
      world.events.off(CombatEvents.TARGET_CHANGED, onTargetChanged)
      world.entities.off('added', onEntityAdded)
      world.entities.off('removed', onEntityRemoved)
    }
  }, [world, player, target, playerHealth.max])

  return (
    <>
      {/* Player Health Bar (top right) */}
      {player && (
        <PlayerHealthBar
          world={world}
          player={player}
          health={playerHealth}
        />
      )}

      {/* Target Health Bar (top center) */}
      {target && (
        <TargetHealthBar world={world} target={target} bars={bars} />
      )}

      {/* NPC Floating Health Bars */}
      {Array.from(bars.values())
        .filter(bar => bar.entityId !== player?.data?.id) // Don't show floating bar for player
        .map(bar => (
          <NPCHealthBar key={bar.entityId} world={world} bar={bar} />
        ))}
    </>
  )
}

function PlayerHealthBar({ world, player, health }) {
  const healthPercent = (health.current / health.max) * 100
  const playerName = player.data?.name || 'Player'

  // Track combat state
  const [inCombat, setInCombat] = useState(false)

  useEffect(() => {
    const onCombatStateChanged = data => {
      if (data.entityId === player.data?.id) {
        setInCombat(data.inCombat)
      }
    }

    world.events.on('combat:stateChanged', onCombatStateChanged)
    return () => world.events.off('combat:stateChanged', onCombatStateChanged)
  }, [world, player])

  return (
    <div style={{
      ...styles.playerContainer,
      ...(inCombat && styles.playerContainerCombat)
    }}>
      <div style={styles.playerName}>{playerName}</div>
      <div style={styles.playerHealthContainer}>
        <div
          style={{
            ...styles.playerHealthFill,
            width: `${healthPercent}%`,
            background: healthPercent < 25 ? 'linear-gradient(90deg, #ef4444, #dc2626)' :
                       healthPercent < 50 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                       'linear-gradient(90deg, #22c55e, #16a34a)'
          }}
        />
        <div style={styles.playerHealthText}>
          {Math.round(health.current)} / {health.max}
        </div>
      </div>
    </div>
  )
}

function TargetHealthBar({ world, target, bars }) {
  const bar = bars.get(target.data?.id)

  // Fallback to target data if bar not in map yet
  const currentHealth = bar?.currentHealth ?? target.data?.health ?? target.nametag?.health ?? 100
  const maxHealth = bar?.maxHealth ?? target.data?.maxHealth ?? target.nametag?.maxHealth ?? 100
  const healthPercent = (currentHealth / maxHealth) * 100

  // Resolve name from multiple sources (check blueprint.name first for mobs/NPCs)
  const entityName = target.blueprint?.name ||
                     target.data?.name ||
                     target.nametag?.name ||
                     target.name ||
                     (target.data?.blueprint?.replace(/^(npc-|mob-)/i, '').charAt(0).toUpperCase() +
                      target.data?.blueprint?.replace(/^(npc-|mob-)/i, '').slice(1)) ||
                     target.data?.id ||
                     'Unknown'

  return (
    <div style={styles.targetContainer}>
      <div style={styles.targetName}>{entityName}</div>
      <div style={styles.targetHealthContainer}>
        <div
          style={{
            ...styles.targetHealthFill,
            width: `${healthPercent}%`,
            background: healthPercent < 25 ? 'linear-gradient(90deg, #ef4444, #dc2626)' :
                       healthPercent < 50 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                       'linear-gradient(90deg, #22c55e, #16a34a)'
          }}
        />
        <div style={styles.targetHealthText}>
          {Math.round(currentHealth)} / {maxHealth}
        </div>
      </div>
    </div>
  )
}

function NPCHealthBar({ world, bar }) {
  const [position, setPosition] = useState(null)
  const [entityName, setEntityName] = useState('')

  useEffect(() => {
    const entity = world.entities.get(bar.entityId)
    if (!entity) return

    // Get entity name for nameplate - try multiple sources (check blueprint.name first)
    const name = entity.blueprint?.name ||
                 entity.data?.name ||
                 entity.nametag?.name ||
                 entity.name ||
                 (entity.data?.blueprint?.replace(/^(npc-|mob-)/i, '').charAt(0).toUpperCase() +
                  entity.data?.blueprint?.replace(/^(npc-|mob-)/i, '').slice(1)) ||
                 bar.entityId ||
                 'Unknown'

    setEntityName(name)

    const updatePosition = () => {
      const entityPos = entity.position?.value
      if (!entityPos) return

      // Convert 3D world position to 2D screen position
      const screenPos = worldToScreen(world, entityPos.x, entityPos.y + 2.5, entityPos.z)

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
  }, [world, bar.entityId])

  if (!position || !bar.visible) return null

  const healthPercent = (bar.currentHealth / bar.maxHealth) * 100

  // Don't show bar if at full health (optional optimization)
  if (healthPercent >= 100) return null

  return (
    <div style={{
      ...styles.npcNameplate,
      left: position.x + 'px',
      top: position.y + 'px',
    }}>
      <div style={styles.npcName}>{entityName}</div>
      <div style={styles.npcHealthContainer}>
        <div
          style={{
            ...styles.npcHealthFill,
            width: `${healthPercent}%`,
            background: healthPercent < 25 ? 'linear-gradient(90deg, #ef4444, #dc2626)' :
                       healthPercent < 50 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                       'linear-gradient(90deg, #22c55e, #16a34a)'
          }}
        />
      </div>
    </div>
  )
}

const styles = {
  // Player Health Bar (top right)
  playerContainer: {
    position: 'fixed',
    top: 'calc(1rem + env(safe-area-inset-top))',
    right: '8px',
    width: '250px',
    background: 'rgba(11, 10, 21, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px',
    pointerEvents: 'none',
    zIndex: 9999,
  },
  playerName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '6px',
  },
  playerContainerCombat: {
    border: '2px solid #ef4444',
    boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)',
    transition: 'border 0.2s ease, box-shadow 0.2s ease',
  },
  playerHealthContainer: {
    position: 'relative',
    height: '20px',
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  playerHealthFill: {
    height: '100%',
    transition: 'width 0.2s ease-out',
  },
  playerHealthText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },

  // Target Health Bar (top center)
  targetContainer: {
    position: 'fixed',
    top: 'calc(1rem + env(safe-area-inset-top))',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '300px',
    background: 'rgba(11, 10, 21, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '12px',
    pointerEvents: 'none',
    zIndex: 9999,
  },
  targetName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '8px',
    textAlign: 'center',
  },
  targetHealthContainer: {
    position: 'relative',
    height: '24px',
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  targetHealthFill: {
    height: '100%',
    transition: 'width 0.2s ease-out',
  },
  targetHealthText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },

  // NPC Floating Nameplates
  npcNameplate: {
    position: 'fixed',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    width: '100px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    zIndex: 9990,
  },
  npcName: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.9), 0 0 5px rgba(0, 0, 0, 0.8)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100px',
    textAlign: 'center',
  },
  npcHealthContainer: {
    position: 'relative',
    height: '6px',
    width: '80px',
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '3px',
    overflow: 'hidden',
    border: '1px solid rgba(0, 0, 0, 0.5)',
  },
  npcHealthFill: {
    height: '100%',
    transition: 'width 0.15s ease-out',
  },
}
