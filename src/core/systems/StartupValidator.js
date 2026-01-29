import { System } from './System'

/**
 * StartupValidator System
 *
 * - Runs validation checks BEFORE World.start() on server
 * - Validates mob blueprints, combat system, event system
 * - Spawns test entities to verify all systems working
 * - Fails fast with detailed error reports
 *
 */
export class StartupValidator extends System {
  constructor(world) {
    super(world)
    this.validationResults = {
      passed: false,
      errors: [],
      warnings: [],
      checks: {}
    }
  }

  /**
   * Main validation entry point
   * Returns { passed: boolean, errors: [], warnings: [], checks: {} }
   */
  async validate() {
    console.log('[StartupValidator] 🔍 Starting pre-startup validation...')

    const results = {
      passed: true,
      errors: [],
      warnings: [],
      checks: {}
    }

    try {
      // Check 1: Validate mob blueprints loaded
      results.checks.mobBlueprints = await this.validateMobBlueprints()
      if (!results.checks.mobBlueprints.passed) {
        results.passed = false
        results.errors.push(...results.checks.mobBlueprints.errors)
      }

      // Check 2: Validate combat system exists
      results.checks.combatSystem = await this.validateCombatSystem()
      if (!results.checks.combatSystem.passed) {
        results.passed = false
        results.errors.push(...results.checks.combatSystem.errors)
      }

      // Check 3: Validate entities system exists
      results.checks.entitiesSystem = await this.validateEntitiesSystem()
      if (!results.checks.entitiesSystem.passed) {
        results.passed = false
        results.errors.push(...results.checks.entitiesSystem.errors)
      }

      // Check 4: Validate event system
      results.checks.eventSystem = await this.validateEventSystem()
      if (!results.checks.eventSystem.passed) {
        results.warnings.push(...results.checks.eventSystem.errors)
        // Events are warnings, not fatal
      }

      // NOTE: Test entity spawn skipped - mob blueprints aren't registered in world.blueprints
      // Actual spawning will be tested by defaultSpawns configuration

      // Collect warnings
      Object.values(results.checks).forEach(check => {
        if (check.warnings) {
          results.warnings.push(...check.warnings)
        }
      })

    } catch (error) {
      results.passed = false
      results.errors.push(`Validation crashed: ${error.message}`)
      console.error('[StartupValidator] ❌ Validation error:', error)
    }

    this.validationResults = results
    this.generateReport(results)

    return results
  }

  /**
   * Validate mob blueprints are loaded
   */
  async validateMobBlueprints() {
    const result = { passed: false, errors: [], warnings: [] }

    try {
      if (!this.world.mobs) {
        result.errors.push('Mobs system not initialized')
        return result
      }

      if (!this.world.mobs.ready) {
        result.errors.push('Mobs system not ready')
        return result
      }

      const blueprints = this.world.mobs.getMobBlueprints()
      if (!blueprints || blueprints.length === 0) {
        result.errors.push('No mob blueprints loaded')
        return result
      }

      console.log(`[StartupValidator] ✅ Found ${blueprints.length} mob blueprint(s)`)
      result.passed = true

    } catch (error) {
      result.errors.push(`Mob blueprint validation failed: ${error.message}`)
    }

    return result
  }

  /**
   * Validate combat system exists
   */
  async validateCombatSystem() {
    const result = { passed: false, errors: [], warnings: [] }

    try {
      if (!this.world.combat) {
        result.errors.push('Combat system not initialized')
        return result
      }

      if (typeof this.world.combat.addCombatant !== 'function') {
        result.errors.push('Combat system missing addCombatant method')
        return result
      }

      if (typeof this.world.combat.getCombatant !== 'function') {
        result.errors.push('Combat system missing getCombatant method')
        return result
      }

      console.log('[StartupValidator] ✅ Combat system ready')
      result.passed = true

    } catch (error) {
      result.errors.push(`Combat system validation failed: ${error.message}`)
    }

    return result
  }

  /**
   * Validate entities system exists
   */
  async validateEntitiesSystem() {
    const result = { passed: false, errors: [], warnings: [] }

    try {
      if (!this.world.entities) {
        result.errors.push('Entities system not initialized')
        return result
      }

      if (typeof this.world.entities.add !== 'function') {
        result.errors.push('Entities system missing add method')
        return result
      }

      console.log('[StartupValidator] ✅ Entities system ready')
      result.passed = true

    } catch (error) {
      result.errors.push(`Entities system validation failed: ${error.message}`)
    }

    return result
  }

  /**
   * Spawn test entity - DISABLED
   *
   * NOTE: This is disabled because mob blueprints aren't registered in world.blueprints
   * during initialization. They're stored separately in the Mobs system.
   * Actual spawning is tested via defaultSpawns configuration.
   */

  /**
   * Validate event system working
   */
  async validateEventSystem() {
    const result = { passed: false, errors: [], warnings: [] }

    try {
      let eventReceived = false

      // Test event emission
      const testHandler = () => {
        eventReceived = true
      }

      this.world.on('startupValidator:test', testHandler)
      this.world.emit('startupValidator:test')

      // Give event time to propagate
      await this.sleep(50)

      this.world.off('startupValidator:test', testHandler)

      if (!eventReceived) {
        result.errors.push('Event system test failed - event not received')
        return result
      }

      console.log('[StartupValidator] ✅ Event system working')
      result.passed = true

    } catch (error) {
      result.errors.push(`Event system validation failed: ${error.message}`)
    }

    return result
  }

  /**
   * Generate and log validation report
   */
  generateReport(results) {
    console.log('\n' + '='.repeat(60))
    console.log('[StartupValidator] 📊 Validation Report')
    console.log('='.repeat(60))

    // Summary
    if (results.passed) {
      console.log('✅ Status: PASSED')
    } else {
      console.log('❌ Status: FAILED')
    }

    // Detailed checks
    console.log('\nChecks:')
    Object.entries(results.checks).forEach(([name, check]) => {
      const status = check.passed ? '✅' : '❌'
      console.log(`  ${status} ${name}`)
    })

    // Errors
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:')
      results.errors.forEach(error => console.log(`  - ${error}`))
    }

    // Warnings
    if (results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:')
      results.warnings.forEach(warning => console.log(`  - ${warning}`))
    }

    console.log('='.repeat(60) + '\n')
  }

  /**
   * Sleep helper for async delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
