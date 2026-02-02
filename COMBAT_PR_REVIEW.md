# Combat PR Review

## Status: Ready for Review with Notes

## Structure ✅
- **Core Systems** (`src/core/systems/`): CombatSystem, CombatEntityIndex, PerformanceMonitor - ENGINE LEVEL
- **Reference UI** (`src/degen/combat/`): Health bars, damage numbers, targeting - CUSTOMIZABLE REFERENCE

## Issues to Address

### 1. Test Code in Core System ⚠️
**Location:** `src/core/systems/CombatSystem.js` lines 48-50, 324-325, 607-734

**Issue:** "Fake rat" PoC code embedded in core combat system
```javascript
// Initialize fake rats (Phase 4 - Proof of Concept)
this.rats = new Set()
this.nextRatId = 1
```

**Recommendation:** Remove test code or move to `src/degen/combat/utils/testHelpers.js`

### 2. Documentation
- README and TESTING docs are good
- Combat UI is properly isolated in `src/degen/combat/`
- Core systems are engine-level, configurable

## Conclusion
Clean PR structure. Just remove test code from core systems before merge.
