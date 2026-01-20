# Sound Modules

This directory contains all game sound modules. Each module handles a specific category of sounds.

## Adding a New Sound Module

**Example: Adding Magic/Spell Sounds**

### Step 1: Create the Module

Create `MagicModule.js`:

```javascript
import { SoundModule } from '../../core/systems/SoundManager'

export class MagicModule extends SoundModule {
  getSounds() {
    return {
      // Spell casting
      spell_fireball_cast: {
        url: 'asset://sounds/magic/fireball_cast.wav',
        volume: 0.8,
        spatial: true,
        category: 'sfx',
      },
      spell_fireball_impact: {
        url: 'asset://sounds/magic/fireball_impact.wav',
        volume: 0.9,
        spatial: true,
        category: 'sfx',
      },

      // Healing
      spell_heal: {
        url: 'asset://sounds/magic/heal.wav',
        volume: 0.7,
        spatial: false,
        category: 'sfx',
      },

      // Variants for variety
      spell_whoosh: {
        variants: [
          'asset://sounds/magic/whoosh1.wav',
          'asset://sounds/magic/whoosh2.wav',
          'asset://sounds/magic/whoosh3.wav',
        ],
        volume: 0.6,
        spatial: true,
        category: 'sfx',
      },
    }
  }

  init(world, soundManager) {
    super.init(world, soundManager)

    // Listen for spell events
    world.events.on('spellCast', (data) => {
      const spellSound = `spell_${data.spellType}_cast`
      soundManager.play(spellSound, {
        entityId: data.casterId,
      })
    })

    world.events.on('spellImpact', (data) => {
      const impactSound = `spell_${data.spellType}_impact`
      soundManager.play(impactSound, {
        position: data.position,
      })
    })
  }
}
```

### Step 2: Register the Module

Edit `index.js`:

```javascript
import { MagicModule } from './MagicModule'

const MODULES = [
  { name: 'footsteps', module: FootstepsModule },
  { name: 'ambient', module: AmbientModule },
  { name: 'ui', module: UIModule },
  { name: 'magic', module: MagicModule }, // ← Add here
]
```

### Step 3: Use It!

```javascript
// Anywhere in your code
world.sounds.play('spell_fireball_cast', {
  entityId: playerId,
})

// Or via events
world.events.emit('spellCast', {
  spellType: 'fireball',
  casterId: playerId,
})
```

## Current Modules

- **FootstepsModule** - Player/character footsteps, jumps, landings
- **AmbientModule** - Environmental sounds, background music
- **UIModule** - UI interactions, notifications, menus

## Module Structure

Every sound module should:

1. **Extend SoundModule** - Use the base class
2. **Implement getSounds()** - Return sound definitions
3. **Implement init()** - Setup event listeners
4. **Implement destroy()** - Cleanup (optional)

## Sound Definition Fields

```javascript
{
  // Required: URL or variants
  url: 'asset://sounds/example.wav',
  // OR
  variants: ['asset://sounds/1.wav', 'asset://sounds/2.wav'],

  // Optional fields
  volume: 0.8,      // 0-1, default 1.0
  spatial: true,    // boolean, default true
  loop: false,      // boolean, default false
  category: 'sfx',  // 'sfx' | 'music' | 'ambient' | 'ui' | 'voice'
}
```

## Best Practices

### ✅ Do:
- Group related sounds in one module
- Use descriptive sound names
- Set appropriate volumes for context
- Use variants for repetitive sounds
- Add event listeners for automatic playback

### ❌ Don't:
- Create a module for each sound (too granular)
- Use generic names like "sound1", "audio_final"
- Set all volumes to 1.0 without consideration
- Forget to cleanup in destroy()
- Trigger sounds directly without going through SoundManager

## Testing Your Module

```javascript
// In browser console
// List all sounds
world.sounds.listAllSounds()

// Play test sound
world.sounds.play('spell_fireball_cast')

// Check if module is registered
world.sounds.modules.has('magic')

// Access module directly
const magic = world.sounds.modules.get('magic')
```

## Common Patterns

### Pattern 1: Event-Driven Playback

```javascript
init(world, soundManager) {
  world.events.on('playerAction', (action) => {
    if (action.type === 'attack') {
      soundManager.play('sword_swing', { entityId: action.playerId })
    }
  })
}
```

### Pattern 2: Conditional Sound Selection

```javascript
playFootstep(surface, isRunning) {
  const soundName = `footstep_${surface}`
  const volume = isRunning ? 0.8 : 0.5
  this.soundManager.play(soundName, { volume })
}
```

### Pattern 3: Randomized Variants

```javascript
// Definition
hit_grunt: {
  variants: ['grunt1.wav', 'grunt2.wav', 'grunt3.wav'],
}

// Automatically picks random on play
soundManager.play('hit_grunt')
```

### Pattern 4: Position-Based Spatial Audio

```javascript
world.sounds.play('explosion', {
  position: { x: 100, y: 10, z: 50 },
  volume: 1.0,
  spatial: true,
})
```

## File Locations

- **Sound Assets**: `playground/assets/sounds/`
- **Sound Modules**: `src/world/sounds/`
- **Sound System**: `src/core/systems/SoundManager.js`
- **Audio Engine**: `src/core/systems/ClientAudio.js`

## Need Help?

See `SOUND-SYSTEM-ARCHITECTURE.md` in the project root for comprehensive documentation.
