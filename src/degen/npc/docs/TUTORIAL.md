# NPC Creation Tutorial

Step-by-step guide to creating custom NPCs with behaviors in DegenQuest.

## Table of Contents

- [Quick Start](#quick-start)
- [Tutorial 1: Simple Greeter NPC](#tutorial-1-simple-greeter-npc)
- [Tutorial 2: Patrolling Guard](#tutorial-2-patrolling-guard)
- [Tutorial 3: Interactive Merchant](#tutorial-3-interactive-merchant)
- [Debugging Tips](#debugging-tips)
- [Common Patterns](#common-patterns)

---

## Quick Start

Creating an NPC requires 4 steps:

1. **Create NPC directory** in `/src/world/npcs/`
2. **Create character.json** with NPC metadata
3. **Create behavior.js** with custom logic
4. **Add to npcs.json** manifest

Example structure:
```
/src/world/npcs/
├── npcs.json              # Manifest
└── my-npc/
    ├── character.json     # NPC definition
    ├── behavior.js        # Custom behavior
    └── model.vrm          # 3D model (optional)
```

---

## Tutorial 1: Simple Greeter NPC

Let's create a simple NPC that greets nearby players.

### Step 1: Create Directory

```bash
mkdir -p src/world/npcs/greeter
```

### Step 2: Create character.json

Create `src/world/npcs/greeter/character.json`:

```json
{
  "id": "greeter",
  "name": "Friendly Bob",
  "title": "The Greeter",
  "model": "greeter.vrm",
  "level": 1,
  "class": "Civilian",
  "faction": "Townsfolk",

  "stats": {
    "health": 100,
    "maxHealth": 100,
    "moveSpeed": 5.0,
    "aggressive": false
  },

  "ai": {
    "behavior": "stationary",
    "aggroRange": 0
  },

  "behavior": {
    "script": "behavior.js",
    "autoStart": true,
    "config": {
      "greetDistance": 5,
      "greetCooldown": 30000,
      "greetings": [
        "Hello there!",
        "Welcome, traveler!",
        "Greetings, friend!"
      ]
    }
  },

  "spawn": {
    "defaultPosition": [0, 1, 0],
    "autoSpawn": false
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

### Step 3: Create behavior.js

Create `src/world/npcs/greeter/behavior.js`:

```javascript
/**
 * Simple Greeter Behavior
 * Greets players when they come near
 */

export default {
  lastGreetTime: 0,
  greetedPlayers: new Set(),

  async onSpawn({ npc, world, config, events }) {
    console.log(`[Greeter] ${npc.getName()} is ready!`)

    const actions = npc.getSystem('actions')
    const perception = npc.getSystem('perception')

    // Check for nearby players every 2 seconds
    this.checkInterval = setInterval(() => {
      if (!npc.alive()) {
        clearInterval(this.checkInterval)
        return
      }

      const nearest = perception.getNearestPlayer()
      if (nearest && nearest.distance < config.greetDistance) {
        this.greetPlayer(nearest.id, { npc, actions, config })
      }
    }, 2000)
  },

  async greetPlayer(playerId, { npc, actions, config }) {
    const now = Date.now()

    // Check cooldown
    if (now - this.lastGreetTime < config.greetCooldown) {
      return
    }

    // Check if already greeted this player
    if (this.greetedPlayers.has(playerId)) {
      return
    }

    // Select random greeting
    const greetings = config.greetings || ['Hello!']
    const message = greetings[Math.floor(Math.random() * greetings.length)]

    // Greet the player
    await actions.chat(message)

    // Update tracking
    this.lastGreetTime = now
    this.greetedPlayers.add(playerId)

    // Clear greeted status after cooldown
    setTimeout(() => {
      this.greetedPlayers.delete(playerId)
    }, config.greetCooldown)
  },

  onDespawn({ npc }) {
    console.log(`[Greeter] ${npc.getName()} despawning`)

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.greetedPlayers.clear()
  }
}
```

### Step 4: Add to Manifest

Edit `src/world/npcs/npcs.json`:

```json
{
  "name": "NPCs",
  "npcs": ["greeter"]
}
```

### Step 5: Test

1. Start the server: `make start` (or your dev command)
2. Connect to the world
3. Open NPC panel in sidebar
4. Click "Friendly Bob - The Greeter" to spawn
5. Walk near the NPC and watch for greetings!

**Expected Behavior:**
- NPC spawns at [0, 1, 0]
- When you walk within 5 units, NPC greets you
- Won't greet again for 30 seconds
- Different random greeting each time

---

## Tutorial 2: Patrolling Guard

Now let's create a guard that patrols waypoints.

### Step 1: Create Directory

```bash
mkdir -p src/world/npcs/patrol-guard
```

### Step 2: Create character.json

Create `src/world/npcs/patrol-guard/character.json`:

```json
{
  "id": "patrol-guard",
  "name": "Guard Roland",
  "title": "City Patrol",
  "model": "guard.vrm",
  "level": 20,
  "class": "Warrior",

  "stats": {
    "health": 200,
    "maxHealth": 200,
    "moveSpeed": 8.0,
    "aggressive": false
  },

  "behavior": {
    "script": "behavior.js",
    "autoStart": true,
    "config": {
      "patrolWaypoints": [
        [0, 0, 0],
        [20, 0, 0],
        [20, 0, 20],
        [0, 0, 20]
      ],
      "patrolSpeed": 3,
      "stopDuration": 2000
    }
  },

  "spawn": {
    "defaultPosition": [0, 1, 0]
  },

  "systems": {
    "actions": { "enabled": true },
    "perception": { "enabled": true, "radius": 15 }
  }
}
```

### Step 3: Create behavior.js

Create `src/world/npcs/patrol-guard/behavior.js`:

```javascript
/**
 * Patrolling Guard Behavior
 * Patrols waypoints with stops at each point
 */

export default {
  async onSpawn({ npc, world, config, events }) {
    console.log(`[Guard] ${npc.getName()} starting patrol`)

    const actions = npc.getSystem('actions')
    const waypoints = config.patrolWaypoints || []

    if (waypoints.length === 0) {
      console.warn('[Guard] No waypoints configured')
      return
    }

    // Start patrol loop
    this.patrolLoop(waypoints, { npc, actions, config })
  },

  async patrolLoop(waypoints, { npc, actions, config }) {
    while (npc.alive()) {
      for (let i = 0; i < waypoints.length; i++) {
        if (!npc.alive()) break

        const waypoint = waypoints[i]
        console.log(`[Guard] Moving to waypoint ${i + 1}/${waypoints.length}`)

        try {
          // Move to waypoint
          await actions.moveTo(waypoint, config.patrolSpeed)

          // Stop and look around
          console.log(`[Guard] Reached waypoint ${i + 1}, pausing`)
          await actions.wait(config.stopDuration || 2000)

        } catch (error) {
          console.error('[Guard] Patrol error:', error)
          break
        }
      }

      // Loop back to start
      console.log('[Guard] Patrol loop complete, restarting')
    }
  },

  onDespawn({ npc }) {
    console.log(`[Guard] ${npc.getName()} ending patrol`)
  }
}
```

### Step 4: Add to Manifest

Edit `src/world/npcs/npcs.json`:

```json
{
  "name": "NPCs",
  "npcs": ["greeter", "patrol-guard"]
}
```

### Step 5: Test

1. Reload server
2. Spawn "Guard Roland - City Patrol"
3. Watch the guard patrol in a square pattern
4. Guard stops at each corner for 2 seconds

**Expected Behavior:**
- Guard moves to each waypoint in sequence
- Pauses for 2 seconds at each point
- Loops continuously
- Check server logs for patrol progress

---

## Tutorial 3: Interactive Merchant

Create a merchant that responds to commands.

### Step 1: Create Directory

```bash
mkdir -p src/world/npcs/shopkeeper
```

### Step 2: Create character.json

Create `src/world/npcs/shopkeeper/character.json`:

```json
{
  "id": "shopkeeper",
  "name": "Merchant Emma",
  "title": "Shopkeeper",
  "model": "merchant.vrm",
  "level": 10,
  "class": "Merchant",

  "stats": {
    "health": 100,
    "maxHealth": 100,
    "aggressive": false
  },

  "behavior": {
    "script": "behavior.js",
    "autoStart": true,
    "config": {
      "shopItems": [
        { "name": "Health Potion", "price": 50 },
        { "name": "Mana Potion", "price": 40 },
        { "name": "Antidote", "price": 25 }
      ]
    }
  },

  "spawn": {
    "defaultPosition": [10, 1, 10]
  },

  "systems": {
    "actions": { "enabled": true },
    "perception": { "enabled": true, "radius": 8 }
  },

  "interactions": {
    "merchant": true
  }
}
```

### Step 3: Create behavior.js

Create `src/world/npcs/shopkeeper/behavior.js`:

```javascript
/**
 * Shopkeeper Behavior
 * Responds to shop commands
 */

export default {
  async onSpawn({ npc, world, config, events }) {
    console.log(`[Shopkeeper] ${npc.getName()} opening shop`)

    // Register shop command
    world.npcEngine.registerCommand('shop', {
      pattern: /^(shop|store|buy)$/i,
      async execute(targetNpc, player) {
        if (targetNpc.id !== npc.id) return

        const actions = npc.getSystem('actions')
        const items = config.shopItems || []

        if (items.length === 0) {
          await actions.chat("I'm out of stock!")
          return
        }

        // Show inventory
        const inventory = items
          .map(item => `${item.name}: ${item.price}g`)
          .join(' | ')

        await actions.chat('My wares:')
        await actions.wait(1000)
        await actions.chat(inventory)
      }
    })

    // Register greeting command
    world.npcEngine.registerCommand('greet_merchant', {
      pattern: /^(hello|hi|greetings)$/i,
      async execute(targetNpc, player) {
        if (targetNpc.id !== npc.id) return

        const actions = npc.getSystem('actions')
        const playerName = player.data?.name || 'friend'

        await actions.chat(`Welcome, ${playerName}!`)
        await actions.wait(1000)
        await actions.chat('Say "shop" to see my wares.')
      }
    })

    console.log('[Shopkeeper] Commands registered')
  },

  async onInteract(player, { npc, world, config }) {
    const actions = npc.getSystem('actions')
    const playerName = player.data?.name || 'traveler'

    await actions.chat(`Greetings, ${playerName}!`)
    await actions.wait(1000)
    await actions.chat('Say "shop" to browse, or "hello" to chat.')
  },

  onDespawn({ npc }) {
    console.log(`[Shopkeeper] ${npc.getName()} closing shop`)
  }
}
```

### Step 4: Add to Manifest

Edit `src/world/npcs/npcs.json`:

```json
{
  "name": "NPCs",
  "npcs": ["greeter", "patrol-guard", "shopkeeper"]
}
```

### Step 5: Test

1. Reload server
2. Spawn "Merchant Emma - Shopkeeper"
3. Walk near the NPC
4. In chat, type: `shop`
5. NPC will show inventory
6. Try: `hello`

**Expected Behavior:**
- Click NPC: Shows greeting and instructions
- Say "shop": Displays inventory with prices
- Say "hello": Greets you personally
- Commands work within 5 units of NPC

---

## Debugging Tips

### 1. Check Server Logs

Server logs show NPC lifecycle events:

```
[npcs] ✓ loaded behavior: greeter
[npc-engine] ✓ Behavior onSpawn executed: greeter
[Greeter] Friendly Bob is ready!
```

### 2. Add Console Logs

Liberally use console.log in your behavior:

```javascript
async onSpawn({ npc, world, config }) {
  console.log('[MyNPC] Spawned with config:', config)

  const actions = npc.getSystem('actions')
  console.log('[MyNPC] Actions system:', actions ? 'OK' : 'MISSING')
}
```

### 3. Validate Systems

Always check if systems are available:

```javascript
const actions = npc.getSystem('actions')
if (!actions) {
  console.error('[MyNPC] ActionSystem not available!')
  return
}
```

### 4. Test in Isolation

Test one feature at a time:

```javascript
// Test 1: Just spawn
async onSpawn({ npc }) {
  console.log('Spawn OK')
}

// Test 2: Add chat
async onSpawn({ npc }) {
  const actions = npc.getSystem('actions')
  await actions.chat('Test message')
  console.log('Chat OK')
}

// Test 3: Add patrol
// ... etc
```

### 5. Check Character.json Syntax

Use a JSON validator if NPC doesn't load:
- Missing commas
- Trailing commas
- Incorrect bracket matching
- String escaping issues

### 6. Verify Manifest

Make sure NPC is in `npcs.json`:

```json
{
  "name": "NPCs",
  "npcs": ["my-npc"]  // Must match directory name
}
```

### 7. Common Issues

**NPC doesn't appear in UI:**
- Check `npcs.json` includes the NPC
- Verify `character.json` has valid `id` field
- Restart server after adding new NPC

**Behavior doesn't execute:**
- Check `behavior.autoStart: true` in character.json
- Verify `behavior.script` matches filename
- Check server logs for behavior loading errors

**Actions don't work:**
- Ensure `systems.actions.enabled: true`
- Check `npc.getSystem('actions')` returns non-null
- Verify NPC is alive: `npc.alive()`

**Commands don't respond:**
- Make sure you're within 5 units of NPC
- Check command pattern regex is correct
- Verify `targetNpc.id === npc.id` in execute
- Enable commands in NPCEngineSystem init

---

## Common Patterns

### Pattern: Timed Actions

Execute actions on an interval:

```javascript
async onSpawn({ npc, world, config }) {
  const actions = npc.getSystem('actions')

  this.timerInterval = setInterval(async () => {
    if (!npc.alive()) {
      clearInterval(this.timerInterval)
      return
    }

    await actions.chat('Time passes...')
  }, 10000) // Every 10 seconds
}

onDespawn() {
  if (this.timerInterval) {
    clearInterval(this.timerInterval)
  }
}
```

### Pattern: State Machine

Implement behavior states:

```javascript
export default {
  state: 'idle',

  async onSpawn({ npc, world, config }) {
    this.updateInterval = setInterval(() => {
      this.update({ npc, world, config })
    }, 1000)
  },

  async update({ npc, world, config }) {
    const perception = npc.getSystem('perception')
    const actions = npc.getSystem('actions')

    switch (this.state) {
      case 'idle':
        const nearest = perception.getNearestPlayer()
        if (nearest && nearest.distance < 10) {
          this.state = 'alert'
          await actions.chat('Who goes there?')
        }
        break

      case 'alert':
        const player = perception.getNearestPlayer()
        if (!player || player.distance > 15) {
          this.state = 'idle'
          await actions.chat('Back to my post.')
        }
        break
    }
  },

  onDespawn() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }
}
```

### Pattern: Proximity Reactions

React to players at different distances:

```javascript
async onSpawn({ npc, world, config }) {
  const perception = npc.getSystem('perception')
  const actions = npc.getSystem('actions')

  this.checkInterval = setInterval(async () => {
    if (!npc.alive()) {
      clearInterval(this.checkInterval)
      return
    }

    const nearest = perception.getNearestPlayer()

    if (!nearest) return

    if (nearest.distance < 2) {
      await actions.chat('Too close!')
    } else if (nearest.distance < 5) {
      await actions.chat('I see you there.')
    } else if (nearest.distance < 10) {
      // Silent awareness
    }
  }, 2000)
}
```

### Pattern: Dialog Sequences

Chain multiple messages:

```javascript
async showDialog(player, { npc, actions }) {
  const playerName = player.data?.name || 'stranger'

  await actions.chat(`Greetings, ${playerName}.`)
  await actions.wait(2000)

  await actions.chat('I have a quest for you.')
  await actions.wait(2000)

  await actions.chat('Will you help me?')
}
```

### Pattern: Event-Driven Behavior

Use events for loose coupling:

```javascript
async onSpawn({ npc, world, config, events }) {
  // Subscribe to custom events
  events.on('player_nearby', this.onPlayerNearby.bind(this))
  events.on('health_changed', this.onHealthChanged.bind(this))

  // Emit custom events
  events.emit('npc_ready', { npcId: npc.id })
}

onPlayerNearby(data) {
  console.log('Player nearby:', data)
}

onHealthChanged(data) {
  if (data.health < 50) {
    // React to low health
  }
}

onDespawn({ events }) {
  // Clean up listeners
  events.off('player_nearby', this.onPlayerNearby)
  events.off('health_changed', this.onHealthChanged)
}
```

---

## Next Steps

1. **Study the Examples**
   - Examine `/src/world/npcs/guard/` for patrol behavior
   - Review `/src/world/npcs/merchant/` for commands

2. **Read the API Reference**
   - See [API.md](./API.md) for complete method documentation
   - Learn all available ActionSystem and PerceptionSystem methods

3. **Experiment**
   - Combine patterns to create unique behaviors
   - Try different perception radii and update rates
   - Create custom events for NPC coordination

4. **Share Your NPCs**
   - Document interesting patterns you discover
   - Contribute examples to the community
   - Help improve this tutorial!

---

## Getting Help

If you run into issues:

1. Check server logs for error messages
2. Verify character.json syntax
3. Add console.log statements for debugging
4. Review the [API Reference](./API.md)
5. Examine working examples in `/src/world/npcs/`

Happy NPC building! 🎮
