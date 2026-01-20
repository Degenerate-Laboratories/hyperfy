# Sound System Debugging

Run these commands in the browser console to diagnose the issue:

## 1. Check if systems are initialized

```javascript
console.log('ClientAudio:', !!world.audio)
console.log('SoundManager:', !!world.sounds)
console.log('Network:', !!world.network)
```

## 2. Check network event listener

```javascript
// See if ClientAudio is listening to network events
console.log('Network listeners:', world.network._events)
```

## 3. Test mob sound manually

```javascript
// Find a mob entity
const mobs = Array.from(world.entities.values()).filter(e => e.blueprint?.props?.soundMap)
console.log('Mobs found:', mobs.length)

// Check first mob
if (mobs[0]) {
  const mob = mobs[0]
  console.log('Mob ID:', mob.data.id)
  console.log('Mob soundMap:', mob.blueprint.props.soundMap)

  // Trigger sound manually via network event
  world.network.emit('playSound', {
    entityId: mob.data.id,
    sound: 'idle', // or whatever sound the mob has
    volume: 1.0,
    spatial: true,
    position: { x: mob.data.position[0], y: mob.data.position[1], z: mob.data.position[2] }
  })
}
```

## 4. Monitor network events

```javascript
// Add logging to see if network events are being received
const originalOn = world.network.on.bind(world.network)
world.network.on = function(event, handler) {
  console.log('[network] Registering listener for:', event)
  return originalOn(event, handler)
}

const originalEmit = world.network.emit.bind(world.network)
world.network.emit = function(event, data) {
  if (event === 'playSound') {
    console.log('[network] playSound event:', data)
  }
  return originalEmit(event, data)
}
```

## 5. Check if handlePlaySound is being called

```javascript
// Wrap ClientAudio.handlePlaySound to see if it's called
const originalHandler = world.audio.handlePlaySound
world.audio.handlePlaySound = async function(data) {
  console.log('[audio] handlePlaySound called with:', data)
  return originalHandler.call(world.audio, data)
}
```

## Expected Results

If everything is working:
- All systems should be initialized (all return `true`)
- Network should have playSound listeners
- Manual sound trigger should play sound
- Network events should be logged
- handlePlaySound should be called when mobs trigger sounds

## Quick Test

```javascript
// One-liner to test the full flow
world.network.emit('playSound', {
  entityId: Array.from(world.entities.values()).find(e => e.blueprint?.props?.soundMap)?.data.id,
  sound: 'idle',
  volume: 1.0,
  spatial: true,
  position: { x: 0, y: 0, z: 0 }
})
```
