/**
 * CombatLog - EverQuest-style Combat Log
 *
 * Adapted from v34 for v35
 * Features:
 * - Scrolling combat message log
 * - Message filtering (all, player, damage, important)
 * - Auto-hide after 30s of inactivity
 * - Configurable opacity
 * - Keyboard toggle (L key)
 * - Message deduplication
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { CombatEvents } from '../events/CombatEvents'

// Message types with colors
const MESSAGE_TYPES = {
  DAMAGE: 'damage',
  CRIT: 'crit',
  HEALING: 'healing',
  DEATH: 'death',
  SYSTEM: 'system'
}

const MESSAGE_COLORS = {
  damage: '#ff6b6b',
  crit: '#ff0000',
  healing: '#22c55e',
  death: '#8b0000',
  system: '#ccc'
}

export function CombatLog({ world }) {
  const [messages, setMessages] = useState([])
  const [filter, setFilter] = useState('player')
  const [visible, setVisible] = useState(true)
  const [opacity, setOpacity] = useState(0.9)
  const [autoHide, setAutoHide] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showTimestamps, setShowTimestamps] = useState(false)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const scrollRef = useRef(null)

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('combatLogConfig')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        setFilter(config.filter || 'player')
        setAutoHide(config.autoHide ?? true)
        setOpacity(config.opacity || 0.9)
        setShowTimestamps(config.showTimestamps || false)
      } catch (e) {
        console.error('[CombatLog] Failed to load config:', e)
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('combatLogConfig', JSON.stringify({
      filter,
      autoHide,
      opacity,
      showTimestamps
    }))
  }, [filter, autoHide, opacity, showTimestamps])

  // Add message with deduplication
  const addMessage = useCallback((newMsg) => {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1]

      // Deduplicate: same message within 100ms? Increment count
      if (lastMsg &&
          lastMsg.text === newMsg.text &&
          newMsg.timestamp - lastMsg.timestamp < 100) {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, count: (lastMsg.count || 1) + 1 }
        ]
      }

      // Add new message (keep last 99)
      return [...prev.slice(-99), newMsg]
    })
    setLastActivity(Date.now())
    if (!visible) setVisible(true)
  }, [visible])

  // Combat event handlers
  useEffect(() => {
    if (!world) return

    const onDamage = (data) => {
      const msg = formatDamageMessage(data, world)
      if (msg && shouldShowMessage(msg, filter)) {
        addMessage(msg)
      }
    }

    const onDeath = (data) => {
      const msg = formatDeathMessage(data, world)
      if (msg && shouldShowMessage(msg, filter)) {
        addMessage(msg)
      }
    }

    // Listen for combat events using world.events
    world.events.on(CombatEvents.DAMAGE, onDamage)
    world.events.on(CombatEvents.DEATH, onDeath)

    console.log('[CombatLog] Listening for combat events')

    return () => {
      world.events.off(CombatEvents.DAMAGE, onDamage)
      world.events.off(CombatEvents.DEATH, onDeath)
    }
  }, [world, filter, addMessage])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 30

      if (isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }
  }, [messages])

  // Auto-hide timer
  useEffect(() => {
    if (!autoHide) return

    const timer = setInterval(() => {
      if (Date.now() - lastActivity > 30000) {
        setVisible(false)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [lastActivity, autoHide])

  // Keyboard toggle (L key)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'l' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Only if not typing in input field
        if (document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
          setVisible(v => !v)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const clearMessages = () => setMessages([])

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour12: false })
  }

  return (
    <div style={{
      ...styles.container,
      opacity: visible ? opacity : 0,
      pointerEvents: visible ? 'auto' : 'none'
    }}>
      <div style={styles.header}>
        <div style={styles.title}>Combat Log</div>
        <div style={styles.controls}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All</option>
            <option value="player">Player Only</option>
            <option value="damage">Damage Only</option>
            <option value="important">Important</option>
          </select>
          <button onClick={clearMessages} title="Clear" style={styles.button}>🗑️</button>
          <button onClick={() => setShowSettings(!showSettings)} title="Settings" style={styles.button}>⚙️</button>
          <button onClick={() => setVisible(false)} title="Hide (L to toggle)" style={styles.button}>➖</button>
        </div>
      </div>

      {showSettings && (
        <div style={styles.settings}>
          <label style={styles.settingLabel}>
            <input
              type="checkbox"
              checked={autoHide}
              onChange={(e) => setAutoHide(e.target.checked)}
            />
            <span style={styles.settingText}>Auto-hide after 30s</span>
          </label>

          <label style={styles.settingLabel}>
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
            />
            <span style={styles.settingText}>Show timestamps</span>
          </label>

          <label style={styles.settingLabel}>
            <span style={styles.settingText}>Opacity: {Math.round(opacity * 100)}%</span>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </label>
        </div>
      )}

      <div ref={scrollRef} style={styles.log}>
        {messages
          .filter(msg => shouldShowMessage(msg, filter))
          .map((msg, i) => (
            <div key={i} style={getMessageStyle(msg.type)}>
              {msg.count > 1 && <span style={styles.count}>[x{msg.count}] </span>}
              {msg.text}
              {showTimestamps && <span style={styles.timestamp}> ({formatTime(msg.timestamp)})</span>}
            </div>
          ))}
      </div>
    </div>
  )
}

/**
 * Format combat:damage event message (EverQuest-style)
 */
function formatDamageMessage(data, world) {
  if (!data || data.amount === undefined) {
    console.warn('[CombatLog] Invalid damage event:', data)
    return null
  }

  const playerId = world.entities.player?.data?.id

  const getEntityName = (entityId) => {
    const entity = world.entities.get(entityId)
    return entity?.data?.name || entityId || 'Unknown'
  }

  const attacker = getEntityName(data.sourceId)
  const target = getEntityName(data.targetId)
  let text = ''
  let type = MESSAGE_TYPES.DAMAGE
  let isOther = false

  const isCrit = data.isCrit || false

  if (data.sourceId === playerId) {
    // Player attacking
    if (isCrit) {
      text = `You critically hit ${target} for ${data.amount} points of damage!`
      type = MESSAGE_TYPES.CRIT
    } else {
      text = `You hit ${target} for ${data.amount} points of damage.`
      type = MESSAGE_TYPES.DAMAGE
    }
  } else if (data.targetId === playerId) {
    // Player being attacked
    text = `${attacker} hits YOU for ${data.amount} points of damage.`
    type = MESSAGE_TYPES.DAMAGE
  } else {
    // Other combat
    if (isCrit) {
      text = `${attacker} critically hits ${target} for ${data.amount} points of damage!`
      type = MESSAGE_TYPES.CRIT
    } else {
      text = `${attacker} hits ${target} for ${data.amount} points of damage.`
      type = MESSAGE_TYPES.DAMAGE
    }
    isOther = true
  }

  return {
    text,
    type,
    isOther,
    timestamp: data.timestamp || Date.now()
  }
}

/**
 * Format combat:death event message
 */
function formatDeathMessage(data, world) {
  if (!data || !data.victimId) return null

  const playerId = world.entities.player?.data?.id

  const getEntityName = (entityId) => {
    const entity = world.entities.get(entityId)
    return entity?.data?.name || entityId || 'Unknown'
  }

  const victim = getEntityName(data.victimId)
  const killer = getEntityName(data.killerId)
  let text = ''
  let isOther = false

  if (data.victimId === playerId) {
    text = `You have been slain by ${killer}!`
  } else if (data.killerId === playerId) {
    text = `You have slain ${victim}!`
  } else {
    text = `${victim} has been slain by ${killer}.`
    isOther = true
  }

  return {
    text,
    type: MESSAGE_TYPES.DEATH,
    isOther,
    timestamp: data.timestamp || Date.now()
  }
}

function shouldShowMessage(msg, filter) {
  switch (filter) {
    case 'all':
      return true
    case 'player':
      return !msg.isOther
    case 'damage':
      return msg.type === MESSAGE_TYPES.DAMAGE || msg.type === MESSAGE_TYPES.CRIT
    case 'important':
      return msg.type === MESSAGE_TYPES.CRIT ||
             msg.type === MESSAGE_TYPES.DEATH ||
             msg.type === MESSAGE_TYPES.HEALING
    default:
      return true
  }
}

function getMessageStyle(type) {
  return {
    ...styles.message,
    color: MESSAGE_COLORS[type] || MESSAGE_COLORS.system,
    fontWeight: (type === MESSAGE_TYPES.CRIT || type === MESSAGE_TYPES.DEATH) ? 'bold' : 'normal'
  }
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '120px',
    left: '8px',
    width: '420px',
    maxHeight: '250px',
    background: 'linear-gradient(135deg, rgba(10,10,20,0.92), rgba(20,15,30,0.92))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(100, 150, 255, 0.25)',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9998,
    transition: 'opacity 0.3s ease',
    fontFamily: '"Courier New", monospace'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(100, 150, 255, 0.25)',
    background: 'rgba(20, 20, 40, 0.5)'
  },
  title: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif'
  },
  controls: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  select: {
    background: 'rgba(30, 30, 50, 0.8)',
    color: '#fff',
    border: '1px solid rgba(100, 150, 255, 0.3)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer'
  },
  button: {
    background: 'rgba(30, 30, 50, 0.8)',
    border: '1px solid rgba(100, 150, 255, 0.3)',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '14px',
    lineHeight: 1,
    transition: 'background 0.2s'
  },
  settings: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(100, 150, 255, 0.15)',
    background: 'rgba(15, 15, 25, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  settingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  settingText: {
    color: '#ccc',
    fontSize: '11px',
    fontFamily: 'system-ui, sans-serif'
  },
  slider: {
    flex: 1,
    marginLeft: '8px',
    cursor: 'pointer'
  },
  log: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    fontSize: '12px'
  },
  message: {
    padding: '2px 0',
    lineHeight: '1.5'
  },
  count: {
    color: '#aaa',
    fontSize: '11px'
  },
  timestamp: {
    color: '#666',
    fontSize: '10px',
    marginLeft: '6px'
  }
}
