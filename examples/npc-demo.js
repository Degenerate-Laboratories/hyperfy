/**
 * NPC System Demo
 *
 * Comprehensive example demonstrating all NPC system features.
 *
 * This script should be run on the server side only.
 * Add to your world script or server initialization.
 */

// Server-side only
if (world.network.isServer) {
  console.log('[npc-demo] Initializing NPC demonstration...')

  // ===========================================
  // Example 1: Basic NPC Spawning
  // ===========================================

  async function spawnBasicNPC() {
    console.log('[npc-demo] Example 1: Basic NPC Spawning')

    const basicNPC = await world.npcEngine.spawn({
      id: 'basic-npc-001',
      name: 'Friendly NPC',
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

    // Make NPC greet after spawning
    const actions = basicNPC.getSystem('actions')
    await actions.chat('Hello! I am a basic NPC.')

    console.log(`[npc-demo] ✓ Spawned basic NPC: ${basicNPC.id}`)
    return basicNPC
  }

  // ===========================================
  // Example 2: Action Sequences
  // ===========================================

  async function demonstrateActionSequences() {
    console.log('[npc-demo] Example 2: Action Sequences')

    const npc = await world.npcEngine.spawn({
      id: 'action-demo-001',
      name: 'Action Demo NPC',
      spawnPosition: [10, 0, 0],
      systems: {
        actions: { enabled: true },
      },
    })

    const actions = npc.getSystem('actions')

    // Execute action sequence
    setTimeout(async () => {
      await actions.chat('Watch me perform a sequence of actions!')
      await actions.wait(2000)

      await actions.chat('First, I will move to position [10, 0, 10]')
      await actions.moveTo([10, 0, 10], 2)

      await actions.chat('I have arrived!')
      await actions.wait(2000)

      await actions.chat('Now I will patrol between waypoints.')
      await actions.patrol(
        [
          [10, 0, 10],
          [20, 0, 10],
          [20, 0, 20],
          [10, 0, 20],
        ],
        2,
        true // Loop forever
      )
    }, 5000) // Start after 5 seconds

    console.log(`[npc-demo] ✓ Spawned action demo NPC: ${npc.id}`)
    return npc
  }

  // ===========================================
  // Example 3: Perception and Reactions
  // ===========================================

  async function demonstratePerception() {
    console.log('[npc-demo] Example 3: Perception and Reactions')

    const npc = await world.npcEngine.spawn({
      id: 'perception-demo-001',
      name: 'Watchful Guard',
      spawnPosition: [0, 0, 10],
      systems: {
        actions: { enabled: true },
        perception: {
          enabled: true,
          radius: 15,
          updateRate: 0.5,
        },
      },
    })

    const actions = npc.getSystem('actions')
    const perception = npc.getSystem('perception')

    // Patrol waypoints
    const waypoints = [
      [0, 0, 10],
      [5, 0, 10],
      [5, 0, 15],
      [0, 0, 15],
    ]
    actions.patrol(waypoints, 2, true)

    // React to nearby players
    let lastReaction = 0
    const reactionCooldown = 10000 // 10 seconds

    setInterval(async () => {
      if (!npc.alive()) return

      const nearestPlayer = perception.getNearestPlayer()

      if (nearestPlayer) {
        const now = Date.now()

        if (now - lastReaction > reactionCooldown) {
          if (nearestPlayer.distance < 5) {
            await actions.chat('Halt! Who approaches?')
            lastReaction = now
          } else if (nearestPlayer.distance < 10) {
            await actions.chat('I see you, traveler.')
            lastReaction = now
          }
        }
      }
    }, 1000) // Check every second

    console.log(`[npc-demo] ✓ Spawned perception demo NPC: ${npc.id}`)
    return npc
  }

  // ===========================================
  // Example 4: Player Commands
  // ===========================================

  async function demonstrateCommands() {
    console.log('[npc-demo] Example 4: Player Commands')

    const npc = await world.npcEngine.spawn({
      id: 'command-demo-001',
      name: 'Helpful Guide',
      spawnPosition: [-5, 0, 5],
      systems: {
        actions: { enabled: true },
        perception: {
          enabled: true,
          radius: 10,
        },
      },
    })

    const actions = npc.getSystem('actions')

    // Announce available commands
    setTimeout(async () => {
      await actions.chat('Hello! Try talking to me!')
      await actions.wait(2000)
      await actions.chat('Say "follow me" and I will follow you.')
      await actions.wait(2000)
      await actions.chat('Say "stop" to make me stop.')
      await actions.wait(2000)
      await actions.chat('Say "hello" to greet me!')
    }, 3000)

    console.log(`[npc-demo] ✓ Spawned command demo NPC: ${npc.id}`)
    console.log('[npc-demo] Default commands available: follow, stop, hello, come here, status')
    return npc
  }

  // ===========================================
  // Example 5: Custom Commands
  // ===========================================

  async function demonstrateCustomCommands() {
    console.log('[npc-demo] Example 5: Custom Commands')

    const npc = await world.npcEngine.spawn({
      id: 'custom-cmd-001',
      name: 'Dancing NPC',
      spawnPosition: [15, 0, 0],
      systems: {
        actions: { enabled: true },
      },
    })

    // Register custom command
    world.npcEngine.registerCommand('dance', {
      pattern: /^dance$/i,
      description: 'Make NPC dance',
      execute: async (npc, player) => {
        const actions = npc.getSystem('actions')

        await actions.chat('Time to dance! 💃')

        // Dance movement pattern
        const danceSteps = [
          [16, 0, 0],
          [15, 0, 1],
          [14, 0, 0],
          [15, 0, -1],
          [15, 0, 0], // Back to center
        ]

        for (const step of danceSteps) {
          await actions.moveTo(step, 3)
          await actions.wait(200)
        }

        await actions.chat('Thanks for the dance!')
      },
    })

    const actions = npc.getSystem('actions')
    await actions.chat('Say "dance" to make me dance!')

    console.log(`[npc-demo] ✓ Registered custom command: dance`)
    return npc
  }

  // ===========================================
  // Example 6: NPC Lifecycle Management
  // ===========================================

  async function demonstrateLifecycle() {
    console.log('[npc-demo] Example 6: NPC Lifecycle Management')

    // Spawn temporary NPC
    const tempNPC = await world.npcEngine.spawn({
      id: 'temp-npc-001',
      name: 'Temporary NPC',
      spawnPosition: [20, 0, 0],
      systems: {
        actions: { enabled: true },
      },
    })

    const actions = tempNPC.getSystem('actions')

    await actions.chat('I am temporary. I will disappear in 30 seconds.')

    // Despawn after 30 seconds
    setTimeout(() => {
      console.log('[npc-demo] Despawning temporary NPC...')
      world.npcEngine.despawn(tempNPC.id)
      console.log('[npc-demo] ✓ Temporary NPC despawned')
    }, 30000)

    console.log(`[npc-demo] ✓ Spawned temporary NPC: ${tempNPC.id}`)
    return tempNPC
  }

  // ===========================================
  // Example 7: Multiple NPCs Interaction
  // ===========================================

  async function demonstrateMultipleNPCs() {
    console.log('[npc-demo] Example 7: Multiple NPCs')

    const npc1 = await world.npcEngine.spawn({
      id: 'multi-npc-001',
      name: 'Alice',
      spawnPosition: [-10, 0, 0],
      systems: { actions: { enabled: true } },
    })

    const npc2 = await world.npcEngine.spawn({
      id: 'multi-npc-002',
      name: 'Bob',
      spawnPosition: [-10, 0, 5],
      systems: { actions: { enabled: true } },
    })

    // Coordinated conversation
    setTimeout(async () => {
      const actions1 = npc1.getSystem('actions')
      const actions2 = npc2.getSystem('actions')

      await actions1.chat('Hello Bob!')
      await actions1.wait(2000)

      await actions2.chat('Hello Alice! Nice weather today.')
      await actions2.wait(2000)

      await actions1.chat('Indeed! Perfect for an adventure.')
    }, 5000)

    console.log(`[npc-demo] ✓ Spawned multiple NPCs for interaction demo`)
  }

  // ===========================================
  // Run All Examples
  // ===========================================

  async function runAllExamples() {
    try {
      console.log('[npc-demo] Starting all NPC demonstrations...')

      await spawnBasicNPC()
      await demonstrateActionSequences()
      await demonstratePerception()
      await demonstrateCommands()
      await demonstrateCustomCommands()
      await demonstrateLifecycle()
      await demonstrateMultipleNPCs()

      console.log('[npc-demo] ✓ All demonstrations complete!')

      // Print stats
      const stats = world.npcEngine.getStats()
      console.log('[npc-demo] NPC Engine Stats:', stats)
    } catch (error) {
      console.error('[npc-demo] Error running demonstrations:', error)
    }
  }

  // Run all examples after a short delay
  setTimeout(runAllExamples, 2000)
}

// Client-side: Just log that NPCs are server-controlled
if (world.isClient) {
  console.log('[npc-demo] NPCs are server-controlled. You can interact via chat commands!')
}
