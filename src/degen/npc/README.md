# NPC System

Hybrid NPC system for Hyperfy that combines v34's clean NPCEngine orchestration architecture with v35's native Mob/AIController infrastructure.

## Features

- **Dual API Access**: High-level Systems API (v4-style) + Low-level degen proxy (v5-style)
- **Server-Authoritative**: NPCs are server-controlled Mob entities with network sync
- **Pluggable Systems**: ActionSystem, PerceptionSystem, and custom systems
- **Promise-Based Actions**: Async action sequences for complex behaviors
- **Event-Driven**: EventBus for lifecycle events and communication
- **Player Commands**: Built-in command system with customizable commands
- **Minimal Overhead**: ~10KB per NPC, 10Hz update rate

## Architecture

```
NPCEngine (Orchestration Layer)
├── HyperfyAdapter → Creates Mob entities
├── System Registry → ActionSystem, PerceptionSystem
├── Plugin System → CommandPlugin
├── EventBus → Lifecycle events
└── NPC Registry → Map<id, NPC>
    └── NPC Container
        ├── Mob Entity (v35 native)
        ├── AIController (v35 native)
        └── Systems (v34 pattern)
```

## Quick Start

### 1. Basic NPC Spawning

```javascript
// Server-side only
if (world.network.isServer) {
  // Spawn a basic NPC
  const npc = await world.npcEngine.spawn({
    id: 'guard-001',
    name: 'Guard Captain',
    spawnPosition: [0, 0, 5],
    health: 100,
    maxHealth: 100,
    systems: {
      actions: { enabled: true },
      perception: {
        enabled: true,
        radius: 10,
      },
    },
  })

  // Use the ActionSystem
  const actions = npc.getSystem('actions')
  await actions.chat('Hello, traveler!')
}
```

### 2. Action Sequences

```javascript
const actions = npc.getSystem('actions')

// Chain actions with promises
await actions.chat('Watch me move!')
await actions.moveTo([10, 0, 5], 2)
await actions.chat('I have arrived!')
await actions.wait(2000)
await actions.chat('Now I will patrol.')

// Patrol between waypoints
await actions.patrol(
  [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, 10],
    [0, 0, 10],
  ],
  2, // speed
  true // loop
)
```

### 3. Perception and Reactions

```javascript
const perception = npc.getSystem('perception')
const actions = npc.getSystem('actions')

// Check for nearby players
setInterval(async () => {
  const nearestPlayer = perception.getNearestPlayer()

  if (nearestPlayer && nearestPlayer.distance < 5) {
    await actions.chat('Welcome, traveler!')
  }
}, 3000)
```

### 4. Player Commands

NPCs respond to chat commands automatically:

```javascript
// Built-in commands:
// - "hello" / "hi" → Greet NPC
// - "follow me" → NPC follows player
// - "stop" / "stay" → NPC stops following
// - "come here" → NPC comes to player
// - "status" / "health" → NPC reports status

// Register custom command
world.npcEngine.registerCommand('dance', {
  pattern: /^dance$/i,
  description: 'Make NPC dance',
  execute: async (npc, player) => {
    const actions = npc.getSystem('actions')
    await actions.chat('Time to dance!')
    // ... dance logic
  },
})
```

## API Reference

### NPCEngine

Main orchestrator for NPC management.

**Methods:**
- `spawn(config)` - Spawn an NPC
- `despawn(id)` - Despawn an NPC
- `getNPC(id)` - Get NPC by ID
- `getAllNPCs()` - Get all NPCs
- `registerSystem(name, factory)` - Register custom system
- `update(delta)` - Update all NPCs
- `destroy()` - Cleanup

**Events:**
- `NPC_SPAWNED` - { npcId, npc }
- `NPC_DESTROYED` - { npcId }

### NPC Container

Wraps Mob entity and manages systems.

**Properties:**
- `id` - NPC identifier
- `mob` - Mob entity reference
- `aiController` - AIController reference
- `systems` - Map of attached systems

**Methods:**
- `addSystem(name, system)` - Add a system
- `getSystem(name)` - Get system by name
- `hasSystem(name)` - Check if system exists
- `update(delta)` - Update all systems
- `getPosition()` - Get NPC position
- `getHealth()` - Get current health
- `alive()` - Check if alive

### ActionSystem

Promise-based action system.

**Methods:**
- `moveTo(target, speed, threshold)` - Move to position
- `chat(message, duration)` - Send chat message
- `wait(duration)` - Wait for duration
- `followPlayer(targetId, speed, distance)` - Follow player
- `stopFollowing()` - Stop following
- `patrol(waypoints, speed, loop)` - Patrol waypoints
- `flee(threatId, speed, safeDistance)` - Flee from threat
- `executeSequence(actions)` - Execute action sequence
- `findNearestPlayer(maxDistance)` - Find nearest player
- `getPlayersInRange(radius)` - Get players in range
- `canSeePlayer(playerId, maxDistance)` - Check line of sight

### PerceptionSystem

Manages NPC awareness of surroundings.

**Methods:**
- `getNearestPlayer()` - Get nearest player
- `getNearestEntity()` - Get nearest entity
- `getEntitiesInRange()` - Get all entities in range
- `getPlayersInRange()` - Get all players in range
- `getMobsInRange()` - Get all mobs in range
- `hasEntitiesInRange()` - Check if any entities detected
- `isEntityInRange(entityId)` - Check if specific entity in range
- `getDistanceToEntity(entityId)` - Get distance to entity
- `setRadius(radius)` - Update perception radius

### CommandPlugin

Player command system.

**Methods:**
- `register(name, command)` - Register command
- `unregister(name)` - Remove command
- `process(npcId, playerId, message)` - Process chat message
- `getCommands()` - Get all commands
- `getCommandList()` - Get command list for help

## Configuration

### NPC Config Object

```javascript
{
  id: 'unique-id',              // Required: Unique identifier
  name: 'NPC Name',             // Required: Display name
  spawnPosition: [x, y, z],     // Optional: Initial position
  quaternion: [x, y, z, w],     // Optional: Initial rotation
  health: 100,                  // Optional: Current health
  maxHealth: 100,               // Optional: Maximum health
  blueprint: 'blueprint-name',  // Optional: Blueprint reference

  systems: {
    actions: {
      enabled: true             // Enable ActionSystem
    },
    perception: {
      enabled: true,            // Enable PerceptionSystem
      radius: 10,               // Detection radius
      updateRate: 0.2,          // Update frequency (seconds)
      detectPlayers: true,      // Detect players
      detectMobs: false         // Detect other mobs
    }
  },

  aiController: true            // Enable AIController (default: true)
}
```

## Examples

See `examples/npc-demo.js` for comprehensive demonstrations of:
- Basic NPC spawning
- Action sequences
- Perception and reactions
- Player commands
- Custom commands
- NPC lifecycle management
- Multiple NPC interactions

See `src/degen/npc/examples/` for:
- `guard.js` - Patrolling guard with greetings
- `merchant.js` - Stationary merchant with custom commands

## Integration with World

The NPC system is automatically registered with the World system:

```javascript
// NPCEngineSystem is initialized during World.init()
// Access via:
world.npcEngine.spawn(config)
world.npcEngine.despawn(id)
world.npcEngine.getNPC(id)
```

## Performance

- **Memory**: ~25KB per NPC total
  - NPCEngine overhead: ~10KB per NPC
  - Mob entity: ~10KB
  - AIController: ~5KB
- **Update Rate**: 10Hz (matches AIController)
- **Network**: <1KB/s per NPC

## Future Enhancements

- Voice synthesis plugin
- Behavior trees
- Goal-oriented action planning (GOAP)
- NPC-to-NPC interactions
- Persistent NPC state
- Quest system integration

## License

Part of the DegenQuest-v35 project.
