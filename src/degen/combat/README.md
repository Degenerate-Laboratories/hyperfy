# DegenQuest Combat UI System

Unity-style combat UI module for Hyperfy v35. Self-contained, modular, and cleanly separable.

## Architecture

**Location**: `src/degen/combat/`
**Pattern**: In-tree modular system (like `src/degen/ai/`)
**Integration Points**: 2 files modified (createClientWorld.js, CoreUI.js)

### Directory Structure

```
src/degen/combat/
├── index.js                    # Main exports & feature flag
├── README.md                   # This file
├── CombatUI.jsx                # Wrapper component
├── systems/
│   ├── CombatSystem.js         # Combat state management
│   └── TargetingSystem.js      # Click-to-target raycasting
├── components/
│   ├── CombatLog.jsx           # EverQuest-style scrolling log
│   ├── HealthBars.jsx          # WoW-style health bars + nameplates
│   ├── DamageNumbers.jsx       # Floating damage text
│   └── AbilityBar.jsx          # 8-slot spell bar with cooldowns
├── core/
│   ├── CombatComponent.js      # Health/damage calculations
│   ├── TargetingComponent.js   # Targeting logic
│   └── AbilityComponent.js     # Ability/cooldown management
├── events/
│   └── CombatEvents.js         # Event name constants
└── utils/
    └── worldToScreen.js        # 3D → 2D position conversion
```

## Features

### CombatSystem
- Combat state management (health, damage, death)
- Event broadcasting (`combat:damage`, `combat:death`, `entity:health`)
- Apps API injection (app.dealDamage, app.setTarget, etc.)
- Combat log tracking

### TargetingSystem
- Click-to-target with raycasting
- Entity validation (alive, has health, not player)
- Target change events
- Range checking

### UI Components

**CombatLog**:
- EverQuest-style combat messages
- Message filtering (all, player, damage, important)
- Auto-hide after 30s
- Keyboard toggle (L key)
- Message deduplication

**HealthBars**:
- Target health bar (top center)
- Floating NPC nameplates
- Color-coded by health percent (green/yellow/red)
- Real-time updates

**DamageNumbers**:
- Floating damage text above entities
- Critical hit styling
- 2-second fade + float animation

**AbilityBar**:
- 8-slot ability bar (bottom center)
- Keyboard shortcuts (1-8)
- Visual cooldown indicators
- Click to cast

## Integration

### Systems Registration
**File**: `src/core/createClientWorld.js`

```javascript
import { CombatSystem, TargetingSystem } from '../degen/combat/index.js'

world.register('combat', CombatSystem)
world.register('targeting', TargetingSystem)
```

### UI Mounting
**File**: `src/client/components/CoreUI.js`

```javascript
import { CombatUI } from '../../degen/combat/CombatUI.jsx'

{ready && world.combat && <CombatUI world={world} />}
```

## Apps API

Combat systems inject methods into `app` context:

```javascript
// In entity script (*.hyp file)
app.setTarget(entityId)           // Set combat target
app.getTarget()                   // Get current target
app.dealDamage(targetId, amount)  // Deal damage
app.heal(targetId, amount)        // Heal target
app.useAbility(abilityId)         // Activate ability
```

## Events

### Combat Events
- `combat:damage` - Damage dealt (sourceId, targetId, amount, timestamp)
- `combat:death` - Entity death (victimId, killerId, timestamp)
- `combat:heal` - Healing applied (sourceId, targetId, amount, timestamp)
- `combat:target` - Target selected (sourceId, targetId, timestamp)
- `combat:target-changed` - Target changed (target, targetId, name, health, maxHealth)
- `combat:ability-activate` - Ability used (entityId, abilityId, timestamp)

### Entity Events
- `entity:health` - Health changed (entityId, oldHealth, newHealth, maxHealth, timestamp)

## Usage

### Register Combatant
```javascript
world.combat.addCombatant('entity-123', {
  maxHealth: 100,
  armor: 10,
  damage: { min: 5, max: 15 }
})
```

### Deal Damage
```javascript
world.events.emit('combat:damage', {
  sourceId: 'attacker-id',
  targetId: 'target-id',
  amount: 25,
  timestamp: Date.now()
})
```

### Get Combat Stats
```javascript
const stats = world.combat.getCombatStats('entity-123')
// { currentHealth, maxHealth, armor, isDead, healthPercent }
```

### Set Target
```javascript
world.events.emit('combat:target', {
  sourceId: 'player-id',
  targetId: 'mob-id',
  timestamp: Date.now()
})
```

## Disabling

### Method 1: Feature Flag
Set `COMBAT_ENABLED = false` in `src/degen/combat/index.js`

### Method 2: Remove Registration
Comment out in `createClientWorld.js`:
```javascript
// world.register('combat', CombatSystem)
// world.register('targeting', TargetingSystem)
```

### Method 3: Complete Removal
1. Delete `src/degen/combat/` directory
2. Remove 2 lines from `createClientWorld.js`
3. Remove 2 lines from `CoreUI.js`

Core Hyperfy remains fully functional.

## Known Issues

### worldToScreen API
The `utils/worldToScreen.js` implementation is simplified. May need adjustment based on actual v35 camera API.

**Current Implementation**:
```javascript
const vector = new THREE.Vector3(x, y, z)
vector.project(camera)
const screenX = (vector.x * widthHalf) + widthHalf
const screenY = -(vector.y * heightHalf) + heightHalf
```

**Test** if health bars and damage numbers position correctly. If not, check:
- `world.camera.worldToScreen()` method (if it exists)
- `world.graphics.ClientGraphics.worldToScreenFactor()` method
- Three.js projection matrix calculations

## Testing

### Manual Tests
1. Click mob → Should target (health bar appears at top)
2. Emit damage event → Combat log shows message, damage number floats up
3. Press L → Combat log toggles visibility
4. Press 1-3 → Abilities activate (if configured)
5. Move camera → Health bars stay above entities

### Integration Test Script
```javascript
// In browser console
const mob = world.entities.get('mob-id')

// Register combatant
world.combat.addCombatant(mob.data.id, {
  maxHealth: 100,
  armor: 0,
  damage: { min: 10, max: 20 }
})

// Deal damage
world.events.emit('combat:damage', {
  sourceId: world.entities.player.data.id,
  targetId: mob.data.id,
  amount: 25,
  timestamp: Date.now()
})

// Check logs
console.log(world.combat.getCombatLog())
```

## Credits

Migrated from DegenQuest v34 → v35 with architectural improvements:
- Pure core components (framework-agnostic)
- v35 System base class integration
- Event system standardization
- Clean separation of concerns

## Support

For issues or questions:
- Check console for errors
- Verify systems registered: `world.combat`, `world.targeting`
- Test event emission manually
- Check entity data structure (health, maxHealth, position)
