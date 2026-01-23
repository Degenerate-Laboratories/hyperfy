/**
 * CombatUI - Main Combat UI Wrapper
 *
 * Single integration point that renders all combat UI components
 * Provides clean separation and easy enable/disable
 */

import { CombatLog } from './components/CombatLog'
import { HealthBars } from './components/HealthBars'
import { DamageNumbers } from './components/DamageNumbers'
import { AbilityBar } from './components/AbilityBar'

export function CombatUI({ world }) {
  if (!world) {
    console.warn('[CombatUI] No world provided')
    return null
  }

  return (
    <>
      <CombatLog world={world} />
      <HealthBars world={world} />
      <DamageNumbers world={world} />
      <AbilityBar world={world} />
    </>
  )
}
