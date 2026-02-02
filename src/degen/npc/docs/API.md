# NPC Behavior API Reference

Complete API reference for building custom NPC behaviors in DegenQuest.

## Table of Contents

- [Behavior Lifecycle](#behavior-lifecycle)
- [Context Object](#context-object)
- [NPC Instance API](#npc-instance-api)
- [ActionSystem API](#actionsystem-api)
- [PerceptionSystem API](#perceptionsystem-api)
- [World API](#world-api)
- [EventBus API](#eventbus-api)
- [Command Registration](#command-registration)

---

## Behavior Lifecycle

Every behavior.js file exports a default object with lifecycle hooks:

```javascript
export default {
  // Called once when NPC spawns
  async onSpawn({ npc, world, config, events }) {
    // Initialize NPC behavior, start patrols, register events
  },

  // Called every frame (OPTIONAL - use sparingly)
  onUpdate(delta, { npc, world, config }) {
    // Frame-based logic (avoid heavy computation)
  },

  // Called when player interacts (OPTIONAL)
  async onInteract(player, { npc, world, config }) {
    // Handle player clicking/targeting NPC
  },

  // Called before NPC despawns (OPTIONAL)
  onDespawn({ npc, world, config }) {
    // Cleanup intervals, remove event listeners
  }
}
```

### Lifecycle Hook Details

#### `onSpawn({ npc, world, config, events })`

- **When**: Called once when NPC entity is created
- **Purpose**: Initialize behavior state, start patrols, register commands
- **Return**: `Promise<void>` or `void`
- **Context**: Full NPC context with all systems available

**Example:**
```javascript
async onSpawn({ npc, world, config, events }) {
  const actions = npc.getSystem('actions')
  const waypoints = config.patrolWaypoints || []

  if (waypoints.length > 0) {
    await actions.patrol(waypoints, 2, true)
  }

  events.on('player_nearby', this.handlePlayerNearby.bind(this))
}
```

#### `onUpdate(delta, { npc, world, config })`

- **When**: Called every frame (60 FPS)
- **Purpose**: Continuous logic requiring frame updates
- **Warning**: Keep lightweight - runs 60 times per second
- **Return**: `void`

**Example:**
```javascript
onUpdate(delta, { npc, world, config }) {
  // Check if NPC is still alive
  if (!npc.alive()) return

  // Lightweight frame-based logic only
}
```

#### `onInteract(player, { npc, world, config })`

- **When**: Player clicks or targets the NPC
- **Purpose**: Handle direct player interactions
- **Return**: `Promise<void>` or `void`

**Example:**
```javascript
async onInteract(player, { npc, world, config }) {
  const actions = npc.getSystem('actions')
  const playerName = player.data?.name || 'traveler'

  await actions.chat(`Greetings, ${playerName}!`)
}
```

#### `onDespawn({ npc, world, config })`

- **When**: NPC is being destroyed/removed
- **Purpose**: Cleanup resources, clear intervals, remove listeners
- **Return**: `void`

**Example:**
```javascript
onDespawn({ npc, world, config }) {
  if (this.checkInterval) {
    clearInterval(this.checkInterval)
  }

  this.greetedPlayers.clear()
}
```

---

## Context Object

All lifecycle hooks receive a context object with these properties:

```javascript
{
  npc: NPC,           // NPC instance
  world: World,       // World instance
  config: Object,     // Custom config from character.json
  events: EventBus    // Event bus for NPC events
}
```

### `npc` - NPC Instance

See [NPC Instance API](#npc-instance-api) below.

### `world` - World Instance

See [World API](#world-api) below.

### `config` - Behavior Configuration

Custom configuration from `character.json`:

```json
{
  "behavior": {
    "script": "behavior.js",
    "autoStart": true,
    "config": {
      "patrolWaypoints": [[0,0,5], [10,0,5]],
      "greetDistance": 5,
      "customData": "anything you need"
    }
  }
}
```

Access in behavior:
```javascript
const waypoints = config.patrolWaypoints
const distance = config.greetDistance
```

### `events` - EventBus

See [EventBus API](#eventbus-api) below.

---

## NPC Instance API

The `npc` object represents the NPC instance:

```javascript
npc = {
  id: string,                // Unique NPC ID
  config: Object,            // Full spawn configuration
  mob: MobEntity,            // Underlying Mob entity
  aiController: AIController, // AI controller (v35 native)
  isAlive: boolean,          // Current alive state

  // System access
  getSystem(name: string): System,
  hasSystem(name: string): boolean,

  // Utility methods
  getPosition(): [x, y, z],
  getName(): string,
  getHealth(): number,
  alive(): boolean
}
```

### Methods

#### `getSystem(name: string): System`

Get a registered system by name.

**Parameters:**
- `name` - System name ('actions' or 'perception')

**Returns:** System instance or undefined

**Example:**
```javascript
const actions = npc.getSystem('actions')
const perception = npc.getSystem('perception')
```

#### `hasSystem(name: string): boolean`

Check if NPC has a system registered.

**Example:**
```javascript
if (npc.hasSystem('actions')) {
  const actions = npc.getSystem('actions')
}
```

#### `getPosition(): [x, y, z]`

Get NPC's current world position.

**Returns:** Array [x, y, z]

**Example:**
```javascript
const [x, y, z] = npc.getPosition()
console.log(`NPC at: ${x}, ${y}, ${z}`)
```

#### `getName(): string`

Get NPC's display name from config.

**Example:**
```javascript
const name = npc.getName() // "Guard Maximus"
```

#### `getHealth(): number`

Get current health value.

**Example:**
```javascript
const health = npc.getHealth()
if (health < 50) {
  // Low health logic
}
```

#### `alive(): boolean`

Check if NPC is alive (health > 0).

**Example:**
```javascript
if (npc.alive()) {
  // NPC is alive
}
```

---

## ActionSystem API

The ActionSystem provides movement and communication actions.

```javascript
const actions = npc.getSystem('actions')
```

### Movement Actions

#### `moveTo(target, speed?, threshold?): Promise<void>`

Move NPC to a target position.

**Parameters:**
- `target: [x, y, z]` - Target position
- `speed?: number` - Movement speed (default: from stats.moveSpeed)
- `threshold?: number` - Distance threshold (default: 0.5)

**Returns:** Promise that resolves when destination reached

**Example:**
```javascript
await actions.moveTo([10, 0, 5], 3)
console.log('Arrived at destination')
```

#### `patrol(waypoints, speed?, loop?): Promise<void>`

Patrol through multiple waypoints.

**Parameters:**
- `waypoints: Array<[x,y,z]>` - Array of positions
- `speed?: number` - Movement speed
- `loop?: boolean` - Loop back to start (default: false)

**Returns:** Promise that resolves when patrol completes (or never if looping)

**Example:**
```javascript
const waypoints = [
  [0, 0, 5],
  [10, 0, 5],
  [10, 0, 15],
  [0, 0, 15]
]

// Loop forever
await actions.patrol(waypoints, 2, true)
```

#### `followPlayer(playerId, speed?, distance?): Promise<void>`

Follow a specific player.

**Parameters:**
- `playerId: string` - Player entity ID
- `speed?: number` - Movement speed
- `distance?: number` - Follow distance (default: 3)

**Returns:** Promise (continues until stopped)

**Example:**
```javascript
await actions.followPlayer(player.data.id, 4, 2)
```

#### `stopFollowing(): Promise<void>`

Stop following current target.

**Example:**
```javascript
await actions.stopFollowing()
```

#### `flee(threatId, speed?, safeDistance?): Promise<void>`

Flee from a threat entity.

**Parameters:**
- `threatId: string` - Entity ID to flee from
- `speed?: number` - Movement speed
- `safeDistance?: number` - Distance to flee (default: 20)

**Returns:** Promise that resolves when safe distance reached

**Example:**
```javascript
await actions.flee(player.data.id, 6, 30)
```

### Communication Actions

#### `chat(message, duration?): Promise<void>`

Display a chat message above NPC.

**Parameters:**
- `message: string` - Message text
- `duration?: number` - Display duration in ms (default: 3000)

**Returns:** Promise that resolves after message duration

**Example:**
```javascript
await actions.chat('Greetings, traveler!')
await actions.wait(1000)
await actions.chat('How can I help you?')
```

### Utility Actions

#### `wait(duration): Promise<void>`

Wait for a duration before continuing.

**Parameters:**
- `duration: number` - Wait time in milliseconds

**Returns:** Promise that resolves after duration

**Example:**
```javascript
await actions.chat('Hello!')
await actions.wait(2000) // Wait 2 seconds
await actions.chat('How are you?')
```

#### `findNearestPlayer(maxDistance?): {id, distance} | null`

Find the nearest player within range.

**Parameters:**
- `maxDistance?: number` - Maximum search distance

**Returns:** `{id: string, distance: number}` or `null`

**Example:**
```javascript
const nearest = actions.findNearestPlayer(20)
if (nearest) {
  console.log(`Player ${nearest.id} is ${nearest.distance} units away`)
}
```

#### `getPlayersInRange(radius?): Array<{id, distance}>`

Get all players within a radius.

**Parameters:**
- `radius?: number` - Search radius (default: 10)

**Returns:** Array of `{id: string, distance: number}`

**Example:**
```javascript
const players = actions.getPlayersInRange(15)
console.log(`${players.length} players nearby`)
```

---

## PerceptionSystem API

The PerceptionSystem provides awareness of nearby entities.

```javascript
const perception = npc.getSystem('perception')
```

### Methods

#### `getNearestPlayer(): {id, distance, type} | null`

Get the nearest player entity.

**Returns:** `{id: string, distance: number, type: string}` or `null`

**Example:**
```javascript
const nearest = perception.getNearestPlayer()
if (nearest && nearest.distance < 5) {
  console.log('Player is very close!')
}
```

#### `getNearestEntity(): {id, distance, type} | null`

Get the nearest entity of any type.

**Returns:** `{id: string, distance: number, type: string}` or `null`

#### `getEntitiesInRange(): Array<{id, distance, type}>`

Get all entities within perception radius.

**Returns:** Array of entity data

**Example:**
```javascript
const entities = perception.getEntitiesInRange()
for (const entity of entities) {
  console.log(`${entity.type} at distance ${entity.distance}`)
}
```

#### `hasEntitiesInRange(): boolean`

Check if any entities are in range.

**Example:**
```javascript
if (perception.hasEntitiesInRange()) {
  console.log('Entities detected nearby')
}
```

#### `setRadius(radius: number): void`

Update perception radius dynamically.

**Parameters:**
- `radius: number` - New perception radius

**Example:**
```javascript
perception.setRadius(30) // Increase awareness range
```

---

## World API

The `world` object provides access to global systems:

```javascript
world = {
  entities: EntitiesSystem,   // Entity management
  chat: ChatSystem,            // Chat system
  npcEngine: NPCEngineSystem,  // NPC engine
  network: {
    isServer: boolean,
    send(type, data)
  },
  time: number,                // World time
  fixedDeltaTime: number       // Fixed update delta
}
```

### Usage Examples

#### Access Entities

```javascript
const player = world.entities.get(playerId)
const playerPos = player.root?.position || player.data.position
```

#### Send Chat Messages

```javascript
world.chat.add({
  sender: npc.getName(),
  message: 'Hello world!',
  timestamp: Date.now()
})
```

#### Spawn Other NPCs

```javascript
const otherNPC = await world.npcEngine.spawnFromRegistry('guard', {
  position: [10, 0, 10]
})
```

---

## EventBus API

The EventBus enables event-driven behavior:

```javascript
events = {
  on(event: string, handler: Function): void,
  off(event: string, handler: Function): void,
  emit(event: string, data: Object): void
}
```

### Built-in Events

- `NPC_SPAWNED` - NPC spawned
- `NPC_DESTROYED` - NPC destroyed
- `player_nearby` - Player entered range (custom)
- `player_left_range` - Player left range (custom)
- `health_changed` - Health changed
- `death` - NPC died

### Methods

#### `on(event, handler)`

Subscribe to an event.

**Example:**
```javascript
events.on('player_nearby', (data) => {
  console.log('Player nearby:', data)
})
```

#### `off(event, handler)`

Unsubscribe from an event.

**Example:**
```javascript
events.off('player_nearby', this.handlePlayerNearby)
```

#### `emit(event, data)`

Emit a custom event.

**Example:**
```javascript
events.emit('custom_event', { npcId: npc.id, value: 123 })
```

---

## Command Registration

Register custom player commands that NPCs respond to:

```javascript
world.npcEngine.registerCommand('command_name', {
  pattern: RegExp,
  async execute(npc, player) {
    // Command handler
  }
})
```

### Parameters

- `name: string` - Command identifier
- `pattern: RegExp` - Regular expression to match chat messages
- `execute: (npc, player) => Promise<void>` - Handler function

### Example

```javascript
// Simple command
world.npcEngine.registerCommand('greet', {
  pattern: /^(hello|hi|greetings)$/i,
  async execute(npc, player) {
    const actions = npc.getSystem('actions')
    await actions.chat(`Hello, ${player.data.name}!`)
  }
})

// Complex command with parameters
world.npcEngine.registerCommand('follow', {
  pattern: /^follow me$/i,
  async execute(npc, player) {
    const actions = npc.getSystem('actions')
    await actions.chat('Following you!')
    await actions.followPlayer(player.data.id, 4, 2)
  }
})

// Shop command
world.npcEngine.registerCommand('shop', {
  pattern: /^(shop|buy|sell|trade)$/i,
  async execute(npc, player) {
    const actions = npc.getSystem('actions')
    await actions.chat('Here are my wares: ...')
  }
})
```

### Command Matching

- Commands are matched against player chat messages
- Nearest NPC within 5 units processes the command
- Pattern is case-insensitive by default (use `/i` flag)
- Multiple commands can be registered per NPC

---

## Complete Example

Putting it all together:

```javascript
export default {
  lastGreetTime: 0,
  greetedPlayers: new Set(),

  async onSpawn({ npc, world, config, events }) {
    const actions = npc.getSystem('actions')
    const perception = npc.getSystem('perception')

    // Start patrol
    if (config.patrolWaypoints) {
      actions.patrol(config.patrolWaypoints, 2, true)
    }

    // Register command
    world.npcEngine.registerCommand('talk', {
      pattern: /^(talk|speak|chat)$/i,
      async execute(targetNpc, player) {
        if (targetNpc.id !== npc.id) return
        await actions.chat('What would you like to know?')
      }
    })

    // Setup periodic checking
    this.checkInterval = setInterval(() => {
      const nearest = perception.getNearestPlayer()
      if (nearest && nearest.distance < 5) {
        this.greetPlayer(nearest.id, { npc, actions, config })
      }
    }, 2000)

    // Subscribe to events
    events.on('health_changed', (data) => {
      if (data.health < 50) {
        actions.chat('I need healing!')
      }
    })
  },

  async greetPlayer(playerId, { npc, actions, config }) {
    const now = Date.now()
    if (now - this.lastGreetTime < 30000) return
    if (this.greetedPlayers.has(playerId)) return

    await actions.chat('Greetings, traveler!')
    this.lastGreetTime = now
    this.greetedPlayers.add(playerId)

    setTimeout(() => this.greetedPlayers.delete(playerId), 30000)
  },

  async onInteract(player, { npc, world, config }) {
    const actions = npc.getSystem('actions')
    await actions.chat(`Hello, ${player.data.name}!`)
  },

  onDespawn({ npc, world, config }) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    this.greetedPlayers.clear()
  }
}
```

---

## Best Practices

1. **Always check system availability**
   ```javascript
   const actions = npc.getSystem('actions')
   if (!actions) return // Safety check
   ```

2. **Use async/await for actions**
   ```javascript
   await actions.chat('Message 1')
   await actions.wait(1000)
   await actions.chat('Message 2')
   ```

3. **Clean up resources in onDespawn**
   ```javascript
   onDespawn({ npc }) {
     clearInterval(this.interval)
     this.dataStructures.clear()
   }
   ```

4. **Check if NPC is alive**
   ```javascript
   if (!npc.alive()) return
   ```

5. **Use perception for awareness**
   ```javascript
   const perception = npc.getSystem('perception')
   const nearest = perception.getNearestPlayer()
   ```

6. **Handle errors gracefully**
   ```javascript
   try {
     await actions.moveTo(target)
   } catch (error) {
     console.error('Movement failed:', error)
   }
   ```

---

## Next Steps

- See [TUTORIAL.md](./TUTORIAL.md) for step-by-step NPC creation
- Check example NPCs in `/src/world/npcs/`
- Experiment with combining systems for complex behaviors
