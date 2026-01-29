// S3 base URL for emotes (use direct endpoint, not CDN subdomain)
const EMOTE_CDN = 'https://degenquest.nyc3.digitaloceanspaces.com/hyperfy-assets/emotes'

export const Emotes = {
  // ==== CORE MOVEMENT ====
  IDLE: 'asset://mp-idle.glb',
  WALK: 'asset://mp-walk.glb?s=1.5',
  WALK_LEFT: 'asset://mp-walk-left.glb?s=1.5',
  WALK_RIGHT: 'asset://mp-walk-right.glb?s=1.5',
  WALK_BACK: 'asset://mp-walk-back.glb?s=1.5',
  RUN: 'asset://mp-jog.glb?s=1.4',
  RUN_LEFT: 'asset://mp-jog-left.glb?s=1.4',
  RUN_RIGHT: 'asset://mp-jog-right.glb?s=1.4',
  RUN_BACK: 'asset://mp-jog-back.glb?s=1.4',
  JUMP: 'asset://emote-jump.glb',
  FALL: 'asset://emote-fall.glb',
  FLY: 'asset://emote-float.glb',
  FLIP: 'asset://emote-flip.glb?s=1.1',
  TALK: 'asset://emote-talk.glb',

  // ==== COMBAT ====
  ATTACK: `${EMOTE_CDN}/mp-attacking.glb`,
  ATTACK_AXE_DOWNWARD: `${EMOTE_CDN}/Downward Attack With Axe.glb`,
  DEATH: `${EMOTE_CDN}/mp-death.glb`,
  DEATH_BACKWARD: `${EMOTE_CDN}/Death Falling Backwards.glb`,
  DEATH_FORWARD: `${EMOTE_CDN}/Death Falling Forwards.glb`,
  DEATH_LEFT: `${EMOTE_CDN}/Death Falling To The Left.glb`,
  DEATH_KNEE: `${EMOTE_CDN}/Death Hit From The Back Falling On One Knee.glb`,
  DYING_BACKWARD: `${EMOTE_CDN}/Dying Falling Backward.glb`,
  HIT_UPPERCUT: `${EMOTE_CDN}/Getting Rocked By A Big Uppercut.glb`,
  HIT_RUNNING: `${EMOTE_CDN}/Getting Hit On The Right Side Of The Body With An Object When Running.glb`,
}

export const emoteUrls = [
  Emotes.IDLE,
  Emotes.WALK,
  Emotes.WALK_LEFT,
  Emotes.WALK_RIGHT,
  Emotes.WALK_BACK,
  Emotes.RUN,
  Emotes.RUN_LEFT,
  Emotes.RUN_RIGHT,
  Emotes.RUN_BACK,
  Emotes.JUMP,
  Emotes.FALL,
  Emotes.FLY,
  Emotes.FLIP,
  Emotes.TALK,
]

// Helper arrays for randomizing combat animations
export const AttackAnimations = [
  Emotes.ATTACK,
  Emotes.ATTACK_AXE_DOWNWARD,
]

export const HitReactionAnimations = [
  Emotes.HIT_UPPERCUT,
  Emotes.HIT_RUNNING,
]

export const DeathAnimations = [
  Emotes.DEATH,
  Emotes.DEATH_BACKWARD,
  Emotes.DEATH_FORWARD,
  Emotes.DEATH_LEFT,
  Emotes.DEATH_KNEE,
  Emotes.DYING_BACKWARD,
]

// Helper function to get random animation from array
export function getRandomAnimation(animations) {
  return animations[Math.floor(Math.random() * animations.length)]
}
