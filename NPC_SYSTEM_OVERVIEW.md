# NPC System Overview - Hyperfy NPCs Worktree

**VRM-based Fake Player System for DegenQuest v35**

---

## 🎯 What NPCs Are

**NPCs = Fake Players with VRM Models**
- NOT mob apps (mobs are in `modules/mob/` and use app system)
- Player-like entities controlled server-side
- Use VRM (Virtual Reality Model) files for avatars
- Behavior-driven with JavaScript lifecycle hooks
- Server-authoritative with client synchronization

---

## 📂 Directory Structure

```
hyperfy-npcs/
├── src/degen/npc/              # Core NPC engine
│   ├── core/
│   │   ├── NPC.js              # NPC container class
│   │   ├── NPCEngine.js        # Main orchestrator
│   │   ├── NPCRegistry.js      # NPC tracking registry
│   │   └── events/
│   │       └── EventBus.js     # Event system
│   ├── systems/
│   │   ├── ActionSystem.js     # Movement, chat, actions
│   │   ├── PerceptionSystem.js # Player/entity awareness
│   │   └── CommandHandler.js   # Command processing
│   ├── adapters/
│   │   └── HyperfyAdapter.js   # Creates Mob entities as containers
│   ├── plugins/
│   │   └── CommandPlugin.js    # Player command registration
│   ├── examples/
│   │   ├── guard.js            # Guard NPC example
│   │   └── merchant.js         # Merchant NPC example
│   ├── docs/
│   │   ├── API.md              # Complete API reference
│   │   └── TUTORIAL.md         # Step-by-step guide
│   ├── README.md               # System overview
│   └── index.js                # Main exports
│
├── src/world/npcs/             # NPC character definitions
│   ├── npcs.json              # Manifest (lists all NPCs)
│   ├── guard/
│   │   ├── character.json      # Stats, config, behavior ref
│   │   ├── behavior.js         # Lifecycle hooks
│   │   └── guard.vrm          # VRM model file
│   └── merchant/
│       ├── character.json
│       ├── behavior.js
│       └── (merchant.vrm would go here)
│
├── src/core/systems/
│   └── NPCEngineSystem.js      # World system integration
│
├── src/server/
│   └── npcs.js                 # Server-side NPC loader
│
└── examples/
    └── npc-demo.js             # Demo/test script
```

---

## 🏗️ Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────┐
│          World System Integration           │
│    (src/core/systems/NPCEngineSystem.js)    │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│             NPCEngine                        │
│      (Orchestration & Lifecycle)             │
│   - Spawn/despawn NPCs                       │
│   - System registry                          │
│   - Update loop (10Hz)                       │
│   - Event bus                                │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌──▼────────┐
│ NPC      │ │ Action │ │Perception │
│Container │ │System  │ │System     │
│          │ │        │ │           │
│- Mob     │ │-moveTo │ │-detect    │
│- AI      │ │-chat   │ │-range     │
│- Systems │ │-patrol │ │-players   │
└──────┬───┘ └────────┘ └───────────┘
       │
┌──────▼─────────────────────────────┐
│    HyperfyAdapter                  │
│  (Creates Mob entity as container) │
└────────────────────────────────────┘
```

### Core Components

**NPCEngine** (`src/degen/npc/core/NPCEngine.js`)
- Main orchestrator
- Spawns/despawns NPCs
- Manages system registry
- 10Hz update loop
- Event bus for lifecycle events

**NPC Container** (`src/degen/npc/core/NPC.js`)
- Wraps Mob entity + AIController
- Manages attached systems
- Lifecycle: spawn → update → despawn
- State: IDLE, FOLLOWING, WAITING, MOVING, COMBAT

**HyperfyAdapter** (`src/degen/npc/adapters/HyperfyAdapter.js`)
- Creates Mob entities as NPC containers
- Integrates with Hyperfy's entity system
- Server-authoritative spawn/despawn

**ActionSystem** (`src/degen/npc/systems/ActionSystem.js`)
- Promise-based actions
- Movement: moveTo, patrol, follow, flee
- Communication: chat
- Utilities: wait, findNearestPlayer

**PerceptionSystem** (`src/degen/npc/systems/PerceptionSystem.js`)
- Spatial awareness
- Player detection
- Entity queries (mobs, players, entities)
- Configurable radius and update rate

**CommandPlugin** (`src/degen/npc/plugins/CommandPlugin.js`)
- Player command system
- Chat pattern matching
- Command registration/execution

---

## 📋 Character Definition

### character.json Schema

```json
{
  "id": "unique-npc-id",
  "name": "Display Name",
  "title": "Optional Title",
  "model": "filename.vrm",

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
      "customKey": "customValue"
    }
  },

  "spawn": {
    "defaultPosition": [x, y, z],
    "defaultQuaternion": [x, y, z, w],
    "autoSpawn": false,
    "unique": true
  },

  "systems": {
    "actions": {
      "enabled": true
    },
    "perception": {
      "enabled": true,
      "radius": 10,
      "detectPlayers": true
    }
  }
}
```

### behavior.js Lifecycle

```javascript
export default {
  // Called when NPC spawns (required)
  async onSpawn({ npc, world, config, events }) {
    // Initialize behavior
    // Start patrols, register commands, etc.
  },

  // Called every frame (optional, use sparingly)
  onUpdate(delta, { npc, world, config }) {
    // Frame-based logic
  },

  // Called when player interacts (optional)
  async onInteract(player, { npc, world, config }) {
    // Handle player interaction
  },

  // Called before despawn (optional)
  onDespawn({ npc, world, config }) {
    // Cleanup resources
  }
}
```

---

## 🎮 Examples

### Guard NPC

**Location:** `src/world/npcs/guard/`

**Features:**
- Patrols waypoints in a loop
- Greets nearby players (with cooldown)
- Responds to interactions
- Custom dialogue

**Key Code:**
```javascript
// behavior.js
export default {
  async onSpawn({ npc, world, config }) {
    const actions = npc.getSystem('actions')

    // Start patrol
    await actions.patrol(config.patrolWaypoints, 2, true)

    // Periodic player detection
    setInterval(() => {
      const perception = npc.getSystem('perception')
      const nearest = perception.getNearestPlayer()
      if (nearest && nearest.distance < 5) {
        this.greetPlayer(nearest.id, { npc, actions, config })
      }
    }, 2000)
  },

  async onInteract(player, { npc, world, config }) {
    const actions = npc.getSystem('actions')
    await actions.chat(`Greetings, ${player.data.name}!`)
  }
}
```

### Merchant NPC

**Location:** `src/world/npcs/merchant/`

**Features:**
- Stationary shopkeeper
- Registers "shop" command
- Shows inventory
- Interactive greetings

**Key Code:**
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

---

## 🔧 API Quick Reference

### NPCEngine

```javascript
// Spawn NPC
const npc = await world.npcEngine.spawn(config)

// Despawn NPC
world.npcEngine.despawn(npcId)

// Get NPC
const npc = world.npcEngine.getNPC(npcId)

// Get all NPCs
const npcs = world.npcEngine.getAllNPCs()
```

### NPC Container

```javascript
// Get system
const actions = npc.getSystem('actions')
const perception = npc.getSystem('perception')

// Check alive
if (npc.alive()) { /* ... */ }

// Get position
const pos = npc.getPosition()

// Get health
const hp = npc.getHealth()
```

### ActionSystem

```javascript
const actions = npc.getSystem('actions')

// Movement
await actions.moveTo([x, y, z], speed, threshold)
await actions.patrol(waypoints, speed, loop)
await actions.followPlayer(playerId, speed, distance)
await actions.flee(threatId, speed, safeDistance)

// Communication
await actions.chat(message, duration)

// Utilities
await actions.wait(milliseconds)
const player = await actions.findNearestPlayer(maxDistance)
const players = actions.getPlayersInRange(radius)
```

### PerceptionSystem

```javascript
const perception = npc.getSystem('perception')

// Detection
const nearest = perception.getNearestPlayer()
const players = perception.getPlayersInRange()
const entities = perception.getEntitiesInRange()

// Queries
const inRange = perception.isEntityInRange(entityId)
const distance = perception.getDistanceToEntity(entityId)

// Configuration
perception.setRadius(newRadius)
```

---

## 🚀 Development Workflow

### 1. Create New NPC

```bash
# Create directory
mkdir -p src/world/npcs/my-npc

# Create files
touch src/world/npcs/my-npc/character.json
touch src/world/npcs/my-npc/behavior.js
# Add VRM model: my-npc.vrm
```

### 2. Define Character

Edit `character.json`:
```json
{
  "id": "my-npc",
  "name": "My NPC",
  "model": "my-npc.vrm",
  "stats": { "health": 100, "maxHealth": 100, "moveSpeed": 5.0 },
  "behavior": { "script": "behavior.js", "autoStart": true }
}
```

### 3. Implement Behavior

Edit `behavior.js`:
```javascript
export default {
  async onSpawn({ npc, world, config }) {
    const actions = npc.getSystem('actions')
    await actions.chat('Hello world!')
  }
}
```

### 4. Add to Manifest

Edit `src/world/npcs/npcs.json`:
```json
{
  "name": "NPCs",
  "npcs": ["guard", "merchant", "my-npc"]
}
```

### 5. Test

```bash
cd /Users/highlander/gamedev/DegenQuest-v35
make start  # Uses hyperfy-npcs worktree

# Open client, spawn NPC from UI
```

---

## 🧪 Testing

### Unit Tests
```bash
# (When tests are added)
cd /Users/highlander/gamedev/DegenQuest-v35/projects/playground/hyperfy-npcs
npm test
```

### Manual Testing
```bash
# Start server
make start

# Watch logs
tail -f logs/server.log

# Test NPC spawn from client UI
```

---

## 📊 Performance

**Memory:**
- NPCEngine overhead: ~10KB per NPC
- Mob entity container: ~10KB
- AIController: ~5KB
- Total: ~25KB per NPC

**Update Rate:**
- NPCEngine: 10Hz (100ms intervals)
- PerceptionSystem: Configurable (default 200ms)
- ActionSystem: Promise-based (event-driven)

**Network:**
- Sync rate: 8Hz (matches world network rate)
- Bandwidth: <1KB/s per NPC

---

## 🔗 Integration with Hyperfy

### World System

NPCEngine registered as World system:
```javascript
// src/core/World.js
this.register('npcEngine', NPCEngineSystem)
```

### Initialization

```javascript
// Server bootstrap
await world.init({
  npcCharacters: npcManifest,  // Triggers NPC loading
  // ... other options
})
```

### Access

```javascript
// From anywhere with world reference
world.npcEngine.spawn(config)
world.npcEngine.getNPC(id)
```

---

## ⚠️ Important Distinctions

### NPCs vs Mobs

| Feature | NPCs | Mobs |
|---------|------|------|
| **Type** | Fake players | Special apps |
| **Model** | VRM files | 3D models/GLB |
| **System** | NPCEngine | Apps system |
| **Location** | `src/degen/npc/`, `src/world/npcs/` | `modules/mob/` |
| **Definition** | character.json + behavior.js | JavaScript templates → .hyp |
| **Lifecycle** | onSpawn, onUpdate, onInteract | app.configure(), app lifecycle |
| **Purpose** | Player-like entities, NPCs, merchants | Creatures, enemies, AI mobs |

---

## 📚 Documentation

**In This Worktree:**
- `src/degen/npc/README.md` - System overview
- `src/degen/npc/docs/API.md` - Complete API reference
- `src/degen/npc/docs/TUTORIAL.md` - Step-by-step guide
- `examples/npc-demo.js` - Demo script

**Project Root:**
- `/WORKTREE_COORDINATION.md` - Agent coordination
- `/WORKTREE_GUIDE.md` - Worktree management
- `NPC_RESOURCES.md` (this directory) - Quick reference

---

## 🎯 Next Steps

1. **Explore Examples:** Check `guard/` and `merchant/` implementations
2. **Read API Docs:** Review `src/degen/npc/docs/API.md`
3. **Create Test NPC:** Follow workflow above
4. **Test Integration:** Spawn and interact in-game
5. **Build Features:** Add quest system, dialogue trees, shops, etc.

---

**Status:** ✅ NPC System Integrated (Feb 2, 2026)
**Base Branch:** Clean dev (9fdc9ab)
**Merge Commit:** 81de357
**Ready for Development:** Yes

---

**Happy NPC Building!** 🎮👥
