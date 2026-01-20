# Unified Sound System Architecture

## Overview

Game-engine-like sound management system that scales to thousands of sounds without manual imports.

**Key Features:**
- ✅ **Declarative** - Define sounds in modules, not scattered code
- ✅ **Auto-discovery** - No manual imports for each sound
- ✅ **Event-driven** - Play sounds via events, not direct calls
- ✅ **Modular** - Organize sounds by category (footsteps, UI, combat, etc.)
- ✅ **Scalable** - Handles thousands of sounds efficiently
- ✅ **Type-safe** - Central registry prevents typos

## Architecture

```
┌─────────────────────────────────────────────┐
│         SoundManager (System)                │
│  • Central sound registry                    │
│  • Module management                         │
│  • Event routing                             │
│  • Volume control (master + categories)      │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        │           │           │           │
┌───────▼────┐ ┌────▼────┐ ┌───▼──────┐ ┌──▼─────┐
│ Footsteps  │ │   UI    │ │ Ambient  │ │ Combat │
│  Module    │ │  Module │ │  Module  │ │ Module │
└────────────┘ └─────────┘ └──────────┘ └────────┘
```

## Quick Start

### 1. Using the Sound System (Playing Sounds)

```javascript
// In any script or component with access to world:
world.sounds.play('footstep_grass', {
  entityId: playerId,
  volume: 0.8,
})

// Play at specific position
world.sounds.play('explosion', {
  position: { x: 10, y: 5, z: 0 },
  volume: 1.0,
  spatial: true,
})

// Play non-spatial UI sound
world.sounds.play('ui_button_click')
```

### 2. Creating a New Sound Module

```javascript
// src/world/sounds/CombatModule.js
import { SoundModule } from '../../core/systems/SoundManager'

export class CombatModule extends SoundModule {
  // Define all combat sounds
  getSounds() {
    return {
      sword_swing: {
        url: 'asset://sounds/combat/sword_swing.wav',
        volume: 0.7,
        spatial: true,
        category: 'sfx',
      },
      sword_hit: {
        url: 'asset://sounds/combat/sword_hit.wav',
        volume: 0.9,
        spatial: true,
        category: 'sfx',
      },
      // Use variants for randomization
      hit_grunt: {
        variants: [
          'asset://sounds/combat/grunt1.wav',
          'asset://sounds/combat/grunt2.wav',
          'asset://sounds/combat/grunt3.wav',
        ],
        volume: 0.8,
        spatial: true,
        category: 'voice',
      },
    }
  }

  // Setup event listeners
  init(world, soundManager) {
    super.init(world, soundManager)

    // Listen for combat events
    world.events.on('playerAttack', (player) => {
      soundManager.play('sword_swing', { entityId: player.id })
    })

    world.events.on('entityHit', (entity) => {
      soundManager.play('sword_hit', { entityId: entity.id })
      soundManager.play('hit_grunt', { entityId: entity.id })
    })
  }
}
```

### 3. Registering Your Module

Add to `src/world/sounds/index.js`:

```javascript
import { CombatModule } from './CombatModule'

const MODULES = [
  { name: 'footsteps', module: FootstepsModule },
  { name: 'ambient', module: AmbientModule },
  { name: 'ui', module: UIModule },
  { name: 'combat', module: CombatModule }, // ← Add here
]
```

**That's it!** No other changes needed.

## Sound Definition Format

```javascript
{
  soundName: {
    // Required: Sound URL (asset:// or https://)
    url: 'asset://sounds/example.wav',

    // OR use variants for randomization
    variants: [
      'asset://sounds/example1.wav',
      'asset://sounds/example2.wav',
    ],

    // Optional: Volume (0-1), default 1.0
    volume: 0.8,

    // Optional: Spatial audio, default true
    spatial: true,

    // Optional: Loop, default false
    loop: false,

    // Optional: Audio mixer category
    category: 'sfx', // sfx | music | ambient | ui | voice
  }
}
```

## API Reference

### SoundManager

```javascript
// Play a sound
world.sounds.play(soundName, options)

// Options:
// - entityId: Entity to attach sound to
// - position: { x, y, z } for spatial audio
// - volume: Override volume (0-1)
// - spatial: Override spatial setting

// List all sounds
const allSounds = world.sounds.listAllSounds()
// Returns: [{ category, soundName, definition }, ...]

// Get sounds in a category
const footstepSounds = world.sounds.getSoundsInCategory('footsteps')

// Volume control
world.sounds.setMasterVolume(0.5) // 50% master volume
world.sounds.setCategoryVolume('music', 0.3) // 30% music volume
```

### Sound Modules

```javascript
// Access a specific module
const footstepsModule = world.sounds.modules.get('footsteps')

// Call module-specific methods
footstepsModule.triggerJump(playerId)
footstepsModule.triggerLand(playerId)
```

## Migration Guide

### Before (Old Pattern)

```javascript
// world-client.js
import { initPlayerFootsteps } from '../world/player-footsteps'
import { initCharacterSounds } from '../world/character-sounds'
import { initCombatSounds } from '../world/combat-sounds'
// ... more imports as sounds are added

// In init:
initPlayerFootsteps(world)
initCharacterSounds(world)
initCombatSounds(world)
// ... more calls as sounds are added
```

**Problems:**
- ❌ Manual imports grow infinitely
- ❌ Scattered initialization code
- ❌ No central registry
- ❌ Hard to see all sounds

### After (New Pattern)

```javascript
// world-client.js
import { initializeSounds } from '../world/sounds'

// In init:
initializeSounds(world)
```

**Benefits:**
- ✅ Single import, single call
- ✅ Auto-discovers all modules
- ✅ Central registry
- ✅ Easy to browse sounds

## Advanced Features

### 1. Dynamic Volume Control

```javascript
// Adjust volumes at runtime
world.sounds.setCategoryVolume('music', 0.2) // Quiet music during combat
world.sounds.setCategoryVolume('sfx', 1.0)   // Full volume SFX
```

### 2. Event-Driven Playback

```javascript
// In your module
world.events.on('playerJump', (player) => {
  this.soundManager.play('jump', { entityId: player.id })
})

// Trigger from anywhere
world.events.emit('playerJump', player)
```

### 3. Sound Variants (Randomization)

```javascript
// Define multiple variants
footstep_grass: {
  variants: [
    'asset://sounds/grass1.wav',
    'asset://sounds/grass2.wav',
    'asset://sounds/grass3.wav',
  ],
  volume: 0.6,
}

// Automatically picks random variant on each play
world.sounds.play('footstep_grass')
```

### 4. Surface Detection (Example)

```javascript
// In FootstepsModule
detectSurface(position) {
  // Raycast down from position
  const hit = this.world.physics.raycast(
    position,
    { x: 0, y: -1, z: 0 },
    1.0
  )

  if (hit && hit.object) {
    // Check material or tag
    const material = hit.object.userData?.material
    if (material === 'grass') return 'grass'
    if (material === 'stone') return 'stone'
    if (material === 'wood') return 'wood'
  }

  return 'default'
}
```

## Best Practices

### 1. Organize by Category

```
src/world/sounds/
├── index.js           # Registry
├── FootstepsModule.js # Movement sounds
├── CombatModule.js    # Combat sounds
├── UIModule.js        # UI sounds
├── AmbientModule.js   # Environmental sounds
├── MagicModule.js     # Spell/magic sounds
└── VehiclesModule.js  # Vehicle sounds
```

### 2. Use Descriptive Names

```javascript
// ✅ Good
footstep_grass
sword_swing_light
ui_button_hover
explosion_large

// ❌ Bad
sound1
sfx_023
audio_final_v2
```

### 3. Group Related Sounds

```javascript
// ✅ Good - Related sounds in same module
getSounds() {
  return {
    footstep_grass: { ... },
    footstep_stone: { ... },
    jump: { ... },
    land: { ... },
  }
}
```

### 4. Set Appropriate Volumes

```javascript
// Consider the context
{
  ui_button_click: { volume: 0.5 },    // Subtle UI feedback
  explosion: { volume: 1.0 },           // Full volume impact
  ambient_birds: { volume: 0.2 },       // Quiet background
  music_combat: { volume: 0.4 },        // Not overpowering
}
```

### 5. Use Categories for Mixing

```javascript
{
  category: 'music',   // Background music
  category: 'sfx',     // Sound effects
  category: 'ambient', // Environmental sounds
  category: 'ui',      // Interface sounds
  category: 'voice',   // Character voices
}
```

## Performance Considerations

### 1. Sound Pooling
- ClientAudio automatically pools sounds (max 3 per entity)
- FIFO eviction prevents memory leaks

### 2. Spatial Audio
- Set `spatial: false` for local player sounds
- Set `spatial: true` for other entities

### 3. Looping Sounds
- Use `loop: true` for ambient/music
- Track active loops to prevent duplicates

### 4. Resource Loading
- Sounds are cached by ClientLoader
- First play may have loading delay

## Debugging

### List All Registered Sounds

```javascript
// In browser console
const sounds = world.sounds.listAllSounds()
console.table(sounds)
```

### Check Module Registration

```javascript
// Check what modules are loaded
console.log(world.sounds.modules.keys())
// MapIterator { 'footsteps', 'ambient', 'ui', ... }
```

### Monitor Sound Playback

```javascript
// Add logging to track sound usage
const originalPlay = world.sounds.play.bind(world.sounds)
world.sounds.play = (soundName, options) => {
  console.log('[sound]', soundName, options)
  return originalPlay(soundName, options)
}
```

## Future Enhancements

Potential additions to the system:

1. **Sound Pooling per Category** - Limit concurrent sounds per category
2. **Priority System** - Important sounds interrupt less important ones
3. **Ducking** - Automatic volume reduction (e.g., music during voice)
4. **Fade In/Out** - Smooth transitions
5. **3D Cone Audio** - Directional sound sources
6. **Occlusion** - Muffled sounds through walls
7. **Distance Attenuation Curves** - Custom falloff per sound
8. **Hot Reload** - Update sounds without restart

## Comparison to Other Engines

### Unity
```csharp
AudioSource.PlayClipAtPoint(clip, position, volume);
```

### Unreal
```cpp
UGameplayStatics::PlaySoundAtLocation(World, Sound, Location);
```

### Hyperfy (New System)
```javascript
world.sounds.play('explosion', { position, volume })
```

Same level of simplicity, fully integrated with Hyperfy's architecture.

## Questions?

- Check `src/core/systems/SoundManager.js` for implementation details
- Look at example modules in `src/world/sounds/`
- See `ClientAudio.js` for low-level audio engine

---

**Result:** Clean, scalable, game-engine-quality sound system! 🎵
