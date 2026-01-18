# DegenQuest NPC System

Extensible NPC system with behavior files for DegenQuest v35. Combines clean orchestration architecture with native Mob/AIController infrastructure.

## Features

- ✅ **Behavior File System** - Define custom NPCs with behavior.js files
- ✅ **Lifecycle Hooks** - onSpawn, onUpdate, onInteract, onDespawn
- ✅ **ActionSystem** - Movement (patrol, moveTo, follow, flee) and chat
- ✅ **PerceptionSystem** - Awareness of nearby players and entities
- ✅ **Command System** - Register custom player commands
- ✅ **Event System** - Event-driven behavior patterns
- ✅ **Client Sync** - Automatic registry synchronization
- ✅ **Server-Authoritative** - NPCs are server-controlled Mob entities
- ✅ **Promise-Based Actions** - Async action sequences for complex behaviors
- ✅ **Minimal Overhead** - ~10KB per NPC, 10Hz update rate

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

### 1. Create NPC Directory

```bash
mkdir -p src/world/npcs/my-npc
```

### 2. Create character.json

```json
{
  "id": "my-npc",
  "name": "My NPC",
  "title": "Custom NPC",
  "model": "my-npc.vrm",
  "level": 1,
  "class": "Civilian",

  "stats": {
    "health": 100,
    "maxHealth": 100,
    "moveSpeed": 5.0,
    "aggressive": false
  },

  "behavior": {
    "script": "behavior.js",
    "autoStart": true,
    "config": {
      "customSetting": "value"
    }
  },

  "spawn": {
    "defaultPosition": [0, 1, 0]
  },

  "systems": {
    "actions": { "enabled": true },
    "perception": {
      "enabled": true,
      "radius": 10,
      "detectPlayers": true
    }
  }
}
```

### 3. Create behavior.js

```javascript
export default {
  async onSpawn({ npc, world, config, events }) {
    console.log(`${npc.getName()} spawned!`)

    const actions = npc.getSystem('actions')
    await actions.chat('Hello world!')
  },

  async onInteract(player, { npc, world, config }) {
    const actions = npc.getSystem('actions')
    await actions.chat(`Hello, ${player.data.name}!`)
  },

  onDespawn({ npc }) {
    console.log(`${npc.getName()} despawning`)
  }
}
```

### 4. Add to Manifest

Edit `src/world/npcs/npcs.json`:

```json
{
  "name": "NPCs",
  "npcs": ["my-npc"]
}
```

### 5. Test

1. Start server
2. Open NPC panel in client UI
3. Click your NPC to spawn
4. Interact with it!

## Documentation

- **[API Reference](./docs/API.md)** - Complete API documentation for behavior development
- **[Tutorial](./docs/TUTORIAL.md)** - Step-by-step NPC creation guide
- **[README](./README.md)** - This file (overview and architecture)

## Examples

### Guard with Patrol

See: `/src/world/npcs/guard/`

Features:
- Patrols waypoints in a loop
- Greets nearby players (with cooldown)
- Responds to player interactions
- Custom dialog on interact

**Key Behavior:**
```javascript
export default {
  async onSpawn({ npc, world, config }) {
    const actions = npc.getSystem('actions')
    await actions.patrol(config.patrolWaypoints, 2, true)

    // Periodic player detection
    setInterval(() => {
      const perception = npc.getSystem('perception')
      const nearest = perception.getNearestPlayer()
      if (nearest && nearest.distance < 5) {
        this.greetPlayer(nearest.id, { npc, actions, config })
      }
    }, 2000)
  }
}
```

### Merchant with Shop

See: `/src/world/npcs/merchant/`

Features:
- Stationary shopkeeper
- Registers "shop" command
- Shows inventory on command
- Interactive greetings

**Key Behavior:**
```javascript
export default {
  async onSpawn({ npc, world, config }) {
    // Register shop command
    world.npcEngine.registerCommand('shop', {
      pattern: /^(shop|buy|sell|trade)$/i,
      async execute(targetNpc, player) {
        const actions = npc.getSystem('actions')
        const items = config.shopInventory
          .map(item => `${item.name}: ${item.price}g`)
          .join(' | ')
        await actions.chat(`My wares: ${items}`)
      }
    })
  }
}
```

## Behavior Lifecycle

Every behavior.js file exports lifecycle hooks:

```javascript
export default {
  // Called once when NPC spawns (required)
  async onSpawn({ npc, world, config, events }) {
    // Initialize behavior, start patrols, register commands
  },

  // Called every frame (optional, use sparingly)
  onUpdate(delta, { npc, world, config }) {
    // Frame-based logic (avoid heavy computation)
  },

  // Called when player interacts (optional)
  async onInteract(player, { npc, world, config }) {
    // Handle player clicking/targeting NPC
  },

  // Called before NPC despawns (optional)
  onDespawn({ npc, world, config }) {
    // Cleanup intervals, remove event listeners
  }
}
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

## Character.json Schema

### Required Fields

```json
{
  "id": "unique-id",
  "name": "Display Name",
  "model": "filename.vrm",
  "stats": {
    "health": 100,
    "maxHealth": 100,
    "moveSpeed": 5.0,
    "aggressive": false
  }
}
```

### Behavior Configuration

```json
{
  "behavior": {
    "script": "behavior.js",
    "autoStart": true,
    "config": {
      "patrolWaypoints": [[0,0,5], [10,0,5]],
      "greetDistance": 5,
      "greetCooldown": 30000,
      "customData": "anything you need"
    }
  }
}
```

### Spawn Configuration

```json
{
  "spawn": {
    "defaultPosition": [0, 1, 5],
    "defaultQuaternion": [0, 0, 0, 1],
    "autoSpawn": false,
    "unique": true
  }
}
```

### Systems Configuration

```json
{
  "systems": {
    "actions": { "enabled": true },
    "perception": {
      "enabled": true,
      "radius": 20,
      "updateRate": 0.5,
      "detectPlayers": true
    }
  }
}
```

## Best Practices

1. **Always check system availability**
   ```javascript
   const actions = npc.getSystem('actions')
   if (!actions) return // Safety check
   ```

2. **Clean up resources in onDespawn**
   ```javascript
   onDespawn({ npc }) {
     if (this.interval) clearInterval(this.interval)
     this.dataStructures.clear()
   }
   ```

3. **Check if NPC is alive**
   ```javascript
   if (!npc.alive()) return
   ```

4. **Use async/await for actions**
   ```javascript
   await actions.chat('First message')
   await actions.wait(1000)
   await actions.chat('Second message')
   ```

5. **Handle errors gracefully**
   ```javascript
   try {
     await actions.moveTo(target)
   } catch (error) {
     console.error('Movement failed:', error)
   }
   ```

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

## Directory Structure

```
/src/
├── degen/npc/              # Core NPC engine
│   ├── core/
│   │   ├── NPCEngine.js
│   │   └── NPCRegistry.js
│   ├── systems/
│   │   ├── ActionSystem.js
│   │   └── PerceptionSystem.js
│   ├── adapters/
│   │   └── HyperfyAdapter.js
│   ├── plugins/
│   │   └── CommandPlugin.js
│   ├── docs/               # Documentation
│   │   ├── README.md       # This file
│   │   ├── API.md          # API Reference
│   │   └── TUTORIAL.md     # Tutorial
│   └── README.md
│
├── world/npcs/             # NPC definitions
│   ├── npcs.json          # Manifest
│   ├── guard/
│   │   ├── character.json
│   │   ├── behavior.js
│   │   └── guard.vrm
│   └── merchant/
│       ├── character.json
│       ├── behavior.js
│       └── merchant.vrm
│
├── core/systems/
│   └── NPCEngineSystem.js  # World system integration
│
└── server/
    ├── npcs.js            # Server-side NPC loader
    └── index.js           # Bootstrap
```

## Future Enhancements

Planned features:
- Quest system integration
- Dialog tree system
- Shop/trading implementation with inventory
- Combat mechanics
- Party/companion system
- Reputation/faction system
- NPC-to-NPC interactions
- Persistent NPC state
- Behavior trees
- Goal-oriented action planning (GOAP)
- Voice synthesis plugin

## License

Part of the DegenQuest-v35 project.
