import { World } from './World'

import { Server } from './systems/Server'
import { ServerLiveKit } from './systems/ServerLiveKit'
import { ServerNetwork } from './systems/ServerNetwork'
import { ServerLoader } from './systems/ServerLoader'
import { ServerEnvironment } from './systems/ServerEnvironment'
import { ServerMonitor } from './systems/ServerMonitor'
import { ServerAI } from './systems/ServerAI'
import { ServerSound } from './systems/ServerSound'
import { CombatSystem } from '../degen/combat/index.js'

export function createServerWorld() {
  const world = new World()
  world.register('server', Server)
  world.register('livekit', ServerLiveKit)
  world.register('network', ServerNetwork)
  world.register('loader', ServerLoader)
  world.register('environment', ServerEnvironment)
  world.register('monitor', ServerMonitor)
  world.register('ai', ServerAI)
  world.register('sound', ServerSound)

  // Register combat system (server-side only)
  world.register('combat', CombatSystem)

  return world
}
