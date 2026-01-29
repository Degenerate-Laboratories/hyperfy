# Combat UI Testing Guide

## What Should You See?

When you load the game, you should immediately see:

### 1. Player Health Bar (Bottom Left)
- **Location**: Bottom left corner, above chat
- **Shows**: Your name and health (100/100 by default)
- **Color**: Green when healthy, yellow <50%, red <25%

### 2. Combat Log (Bottom Left)
- **Location**: Bottom left, below health bar
- **Toggle**: Press `L` key to show/hide
- **Shows**: Combat messages in EverQuest style
- **Features**:
  - Filter dropdown (All, Player Only, Damage, Important)
  - Settings (auto-hide, timestamps, opacity)
  - Clear button

### 3. Ability Bar (Bottom Center)
- **Location**: Bottom center, below viewport
- **Shows**: 8 ability slots (default: Attack, Fireball, Heal)
- **Keybinds**: Press `1`, `2`, `3` to activate
- **Features**: Cooldown visualization, click to cast

## Testing Targeting

### Manual Test (With Entities)
1. Click on any entity in the world
2. **Expected**: Target health bar appears at top center
3. **Shows**: Entity name and health

### Console Test (No Entities Needed)
```javascript
// Open browser console (F12)

// 1. See available test commands
CombatTest.help()

// 2. Run full automated test
CombatTest.runFullTest()

// This will:
// - Register a test mob
// - Set it as target
// - Deal damage to it
// - Deal damage to player
// - Show combat log
```

## Testing Combat

### Test Damage to Target
```javascript
// First, set a target (click entity or use test)
CombatTest.registerTestMob('mob-1', 100)
CombatTest.testTarget('mob-1')

// Deal damage
CombatTest.testDamage('mob-1', 25)

// Expected:
// - Target health bar updates (100 → 75)
// - Damage number "25" floats up above target
// - Combat log: "You hit mob-1 for 25 points of damage."
```

### Test Damage to Player
```javascript
CombatTest.testPlayerDamage(30)

// Expected:
// - Player health bar updates (100 → 70)
// - Player health bar turns yellow/red if low
// - Combat log: "test-mob hits YOU for 30 points of damage."
```

### Test Healing
```javascript
// Heal the player
CombatTest.testHeal(world.entities.player.data.id, 50)

// Expected:
// - Player health bar increases
// - Combat log shows healing message (green)
```

## Testing Entity Discovery

### List All Entities
```javascript
CombatTest.listEntities()

// Shows all entities with:
// - ID
// - Name
// - Health
// - Position
```

### Get Current Target
```javascript
CombatTest.getTarget()
// Shows currently targeted entity

CombatTest.clearTarget()
// Clears target (target bar disappears)
```

## Expected Behavior

### When You Click an Entity
1. **TargetingSystem** raycasts from click position
2. Finds entity under cursor
3. Validates entity (has health, not player, alive)
4. Emits `combat:target-changed` event
5. **HealthBars** component shows target bar at top
6. Console logs: `[TargetingSystem] TARGET SET: EntityName`

### When Damage is Dealt
1. Event `combat:damage` emitted with `{sourceId, targetId, amount}`
2. **CombatSystem** processes damage
3. Emits `entity:health` event with new health
4. **HealthBars** updates health bar
5. **DamageNumbers** shows floating number
6. **CombatLog** adds message

### Combat Log Messages (EverQuest Style)
- **You hit**: Player attacking
- **hits YOU**: Player being attacked
- **critically hit**: Critical damage
- **has been slain**: Death message
- Colors: Red (damage), Green (heal), Dark red (death), Bright red (crit)

## Troubleshooting

### No Health Bars Showing
```javascript
// Check if systems are registered
console.log(world.combat)  // Should be CombatSystem instance
console.log(world.targeting)  // Should be TargetingSystem instance

// Check if player is registered
world.combat.getCombatStats(world.entities.player.data.id)
```

### Targeting Not Working
```javascript
// Check click event listener
console.log('[Targeting] Clicking should log in console')

// Manually set target
const entities = Array.from(world.entities.items.values())
CombatTest.testTarget(entities[0].data.id)
```

### Health Bars Not Updating
```javascript
// Manually trigger health change
world.events.emit('entity:health', {
  entityId: world.entities.player.data.id,
  oldHealth: 100,
  newHealth: 75,
  maxHealth: 100,
  timestamp: Date.now()
})
```

### Combat Log Not Showing
- Press `L` key to toggle visibility
- Check settings (click ⚙️ icon)
- Try: `CombatTest.getCombatLog()` to see if events are being logged

### Floating Health Bars Not Appearing Above NPCs
This likely means `worldToScreen` utility needs adjustment.

**Check**:
```javascript
// Test worldToScreen manually
import { worldToScreen } from './src/degen/combat/utils/worldToScreen.js'
const pos = worldToScreen(world, 0, 2, 0)
console.log('Screen position:', pos)
```

**If null or incorrect**:
- Check if `world.camera` exists
- Check if `world.graphics.renderer` exists
- May need to adjust projection math in `worldToScreen.js`

## Integration Checklist

- [ ] Player health bar visible (bottom left)
- [ ] Click entity → Target bar appears (top center)
- [ ] Press L → Combat log toggles
- [ ] Press 1-3 → Abilities activate (cooldown shows)
- [ ] `CombatTest.runFullTest()` completes without errors
- [ ] Damage numbers float upward
- [ ] Combat log shows EverQuest-style messages
- [ ] Health bars change color based on health percent
- [ ] Target bar clears when entity dies/despawns

## Console Commands Quick Reference

```javascript
// Quick test
CombatTest.runFullTest()

// Individual tests
CombatTest.listEntities()                    // See all entities
CombatTest.registerTestMob('mob-1', 100)     // Create test mob
CombatTest.testTarget('mob-1')               // Set as target
CombatTest.testDamage('mob-1', 25)           // Deal 25 damage
CombatTest.testPlayerDamage(30)              // Damage player by 30
CombatTest.getCombatLog()                    // View combat log
CombatTest.getTarget()                       // Show current target
CombatTest.clearTarget()                     // Clear target

// Help
CombatTest.help()
```

## Next Steps After Testing

1. **If targeting works**: Great! Click entities to target them
2. **If worldToScreen broken**: Adjust `utils/worldToScreen.js` based on v35 camera API
3. **Add real abilities**: Configure in `components/AbilityBar.jsx`
4. **Style customization**: Modify styles in component files
5. **Entity integration**: Ensure your entities have `health` and `maxHealth` in `entity.data`
