import fs from 'fs-extra'
import path from 'path'
import { importApp } from '../core/extras/appTools'
import { assets } from './assets'

class Mobs {
  constructor() {
    this.list = []
    this.blueprints = new Set()
    this.assetManifest = new Map() // Track which assets belong to which mobs
  }

  /**
   * Recursively extract all asset:// URLs from an object
   * @param {*} obj - Object to scan
   * @returns {Set<string>} Set of asset hashes (without asset:// prefix)
   */
  extractAssetURLs(obj, urls = new Set()) {
    if (!obj) return urls

    if (typeof obj === 'string') {
      if (obj.startsWith('asset://')) {
        urls.add(obj.replace('asset://', ''))
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractAssetURLs(item, urls)
      }
    } else if (typeof obj === 'object') {
      for (const key in obj) {
        this.extractAssetURLs(obj[key], urls)
      }
    }

    return urls
  }

  async init({ rootDir, worldDir }) {
    console.log('[mobs] initializing')
    this.dir = path.join(worldDir, '/mobs')
    this.worldDir = worldDir // Store for icon validation

    try {
      // Ensure mobs directory exists
      await fs.ensureDir(this.dir)

      // Copy over built-in mobs
      await fs.copy(path.join(rootDir, 'src/world/mobs'), this.dir)

      // Check if manifest exists
      const manifestPath = path.join(this.dir, 'manifest.json')
      if (!await fs.pathExists(manifestPath)) {
        console.log('[mobs] No manifest found - no mobs to load')
        return this
      }

      // Load and validate manifest
      const manifest = await fs.readJson(manifestPath)
      if (!manifest.mobs || !Array.isArray(manifest.mobs)) {
        throw new Error('Invalid manifest: mobs array missing')
      }

      if (manifest.mobs.length === 0) {
        console.log('[mobs] No mobs defined in manifest')
        return this
      }

      const blueprints = []

      // Load each mob with fail-fast validation
      for (const mobFilename of manifest.mobs) {
        console.log(`[mobs] Loading ${mobFilename}...`)

        const mobPath = path.join(this.dir, mobFilename)
        if (!await fs.pathExists(mobPath)) {
          throw new Error(
            `Mob file not found: ${mobFilename}\n` +
            `  → Expected path: ${mobPath}\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json or provide the file`
          )
        }

        const mobBuffer = await fs.readFile(mobPath)
        if (mobBuffer.length === 0) {
          throw new Error(
            `Mob file empty: ${mobFilename} (0 bytes)\n` +
            `  → File path: ${mobPath}\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json or fix the corrupted file`
          )
        }

        const mobFile = new File([mobBuffer], mobFilename, {
          type: 'application/octet-stream',
        })

        let mob
        try {
          mob = await importApp(mobFile)
        } catch (error) {
          throw new Error(
            `Failed to parse ${mobFilename}: ${error.message}\n` +
            `  → File may be corrupted or not a valid .hyp file\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json or rebuild the .hyp file`
          )
        }

        // Validate mob blueprint structure
        try {
          this.validateMobBlueprint(mob.blueprint, mobFilename)
        } catch (error) {
          throw new Error(
            `Invalid blueprint in ${mobFilename}: ${error.message}\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json or fix the blueprint`
          )
        }

        // Validate assets exist
        if (!mob.assets || mob.assets.length === 0) {
          throw new Error(
            `No assets found in ${mobFilename}\n` +
            `  → Mob blueprint: ${mob.blueprint.name}\n` +
            `  → A valid mob must have at least a model and script\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json or rebuild with assets`
          )
        }

        console.log(`[mobs]   → Found ${mob.assets.length} assets to extract`)

        // Debug: Log blueprint icon configuration
        if (mob.blueprint.image) {
          console.log(`[mobs]   → Blueprint icon configured: ${mob.blueprint.image.url}`)
        } else {
          console.warn(`[mobs]   ⚠️  No icon configured in blueprint (blueprint.image is missing)`)
        }

        // Upload and validate each asset with fail-fast
        let uploadedCount = 0
        const assetsByType = {}
        let iconAssetExtracted = false

        for (let i = 0; i < mob.assets.length; i++) {
          const asset = mob.assets[i]
          const assetNum = `${i + 1}/${mob.assets.length}`

          if (!asset.file) {
            throw new Error(
              `Asset ${assetNum} in ${mobFilename} is missing file data\n` +
              `  → Asset type: ${asset.type}\n` +
              `  → Asset URL: ${asset.url}\n` +
              `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json - corrupted .hyp file`
            )
          }

          try {
            const result = await assets.upload(asset.file)
            uploadedCount++

            // Track asset types
            assetsByType[asset.type] = (assetsByType[asset.type] || 0) + 1

            // Track if icon was extracted
            if (asset.type === 'image' && mob.blueprint.image && asset.url === mob.blueprint.image.url) {
              iconAssetExtracted = true
              console.log(`[mobs]   → [${assetNum}] ${asset.type}: ${result.filename} (ICON) ${result.skipped ? '(cached)' : '(extracted)'}`)
            } else {
              if (result.skipped) {
                console.log(`[mobs]   → [${assetNum}] ${asset.type}: ${result.filename} (cached)`)
              } else {
                console.log(`[mobs]   → [${assetNum}] ${asset.type}: ${result.filename} (extracted)`)
              }
            }
          } catch (error) {
            throw new Error(
              `Failed to upload asset ${assetNum} from ${mobFilename}\n` +
              `  → Asset type: ${asset.type}\n` +
              `  → Asset URL: ${asset.url}\n` +
              `  → Error: ${error.message}\n` +
              `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json - asset extraction failed`
            )
          }
        }

        // Verify all assets uploaded successfully
        if (uploadedCount !== mob.assets.length) {
          throw new Error(
            `Asset count mismatch in ${mobFilename}\n` +
            `  → Expected: ${mob.assets.length} assets\n` +
            `  → Uploaded: ${uploadedCount} assets\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json - incomplete asset extraction`
          )
        }

        // Validate required asset types
        if (!assetsByType.model) {
          throw new Error(
            `Missing model asset in ${mobFilename}\n` +
            `  → Found asset types: ${Object.keys(assetsByType).join(', ')}\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json - no model found`
          )
        }

        if (!assetsByType.script) {
          throw new Error(
            `Missing script asset in ${mobFilename}\n` +
            `  → Found asset types: ${Object.keys(assetsByType).join(', ')}\n` +
            `  → ACTION REQUIRED: Remove "${mobFilename}" from manifest.json - no script found`
          )
        }

        // Validate icon if blueprint specifies one
        if (mob.blueprint.image) {
          if (!iconAssetExtracted) {
            throw new Error(
              `Icon configured but not extracted in ${mobFilename}\n` +
              `  → Blueprint icon: ${mob.blueprint.image.url}\n` +
              `  → Extracted asset types: ${Object.keys(assetsByType).join(', ')}\n` +
              `  → The .hyp file may be corrupted or the icon asset is missing\n` +
              `  → ACTION REQUIRED: Rebuild ${mobFilename} with icon included`
            )
          }

          // Verify icon file exists on disk
          const iconFilename = mob.blueprint.image.url.replace('asset://', '')
          const iconPath = path.join(this.worldDir, 'assets', iconFilename)

          if (!await fs.pathExists(iconPath)) {
            throw new Error(
              `Icon file missing after extraction in ${mobFilename}\n` +
              `  → Expected path: ${iconPath}\n` +
              `  → Blueprint icon: ${mob.blueprint.image.url}\n` +
              `  → The icon was marked as extracted but file doesn't exist\n` +
              `  → ACTION REQUIRED: Check assets directory permissions or rebuild ${mobFilename}`
            )
          }

          console.log(`[mobs]   ✓ Icon validated: ${iconFilename} exists at ${iconPath}`)
        } else {
          console.warn(`[mobs]   ⚠️  No icon configured for "${mob.blueprint.name}" - will use default placeholder`)
        }

        blueprints.push(mob.blueprint)

        // Track assets in manifest
        const blueprintAssets = this.extractAssetURLs(mob.blueprint)
        const mobId = mob.blueprint.id || mob.blueprint.name
        this.assetManifest.set(mobId, Array.from(blueprintAssets))

        console.log(`[mobs] ✓ ${mob.blueprint.name}: ${uploadedCount} assets validated`)
        console.log(`[mobs]   → Assets: ${Object.entries(assetsByType).map(([k, v]) => `${k}(${v})`).join(', ')}`)
        console.log(`[mobs]   → Tracked ${blueprintAssets.size} asset references for cleanup protection`)
      }

      this.list.push({
        id: 'mobs',
        name: manifest.name,
        blueprints,
      })

      for (const blueprint of blueprints) {
        this.blueprints.add(blueprint)
      }

      console.log(`[mobs] ✓ loaded ${blueprints.length} mob(s)`)

      // Validation passed
      return this

    } catch (error) {
      console.error('\n' + '═'.repeat(80))
      console.error('[mobs] 🚨 FATAL ERROR - SERVER STARTUP BLOCKED')
      console.error('═'.repeat(80))
      console.error('\n' + error.message + '\n')
      console.error('The server will NOT start until this is fixed.')
      console.error('\nTo fix this issue:')
      console.error('  1. Edit: ' + path.join(this.dir, 'manifest.json'))
      console.error('  2. Remove the problematic mob from the "mobs" array')
      console.error('  3. Restart the server\n')
      console.error('Or fix the mob file and rebuild it before restarting.\n')
      console.error('═'.repeat(80) + '\n')

      // Propagate to bootstrap - this will kill the server process
      throw error
    }
  }

  /**
   * Get all assets for a specific mob
   * @param {string} mobId - Mob ID or name
   * @returns {string[]} Array of asset hashes
   */
  getMobAssets(mobId) {
    return this.assetManifest.get(mobId) || []
  }

  /**
   * Get all mob assets across all mobs
   * @returns {string[]} Array of unique asset hashes
   */
  getAllMobAssets() {
    const allAssets = new Set()
    for (const assets of this.assetManifest.values()) {
      assets.forEach(asset => allAssets.add(asset))
    }
    return Array.from(allAssets)
  }

  validateMobBlueprint(blueprint, mobFilename = 'unknown') {
    // Validate blueprint structure with detailed error messages
    if (!blueprint) {
      throw new Error(`Missing blueprint in ${mobFilename}`)
    }

    if (!blueprint.name) {
      throw new Error(`Blueprint missing "name" property`)
    }

    if (!blueprint.script) {
      throw new Error(`Mob "${blueprint.name}" missing script URL`)
    }

    if (!blueprint.model) {
      throw new Error(`Mob "${blueprint.name}" missing model URL`)
    }

    // Validate URLs are properly formatted
    if (typeof blueprint.script !== 'string' || blueprint.script.length === 0) {
      throw new Error(`Mob "${blueprint.name}" has invalid script URL`)
    }

    if (typeof blueprint.model !== 'string' || blueprint.model.length === 0) {
      throw new Error(`Mob "${blueprint.name}" has invalid model URL`)
    }
  }
}

export const mobs = new Mobs()
