import fs from 'fs-extra'
import path from 'path'
import { hashFile } from '../core/utils-server'

export class AssetsLocal {
  constructor() {
    this.url = process.env.ASSETS_BASE_URL
    this.dir = null
  }

  async init({ rootDir, worldDir }) {
    console.log('[assets] initializing')
    this.dir = path.join(worldDir, '/assets')
    // ensure assets directory exists
    await fs.ensureDir(this.dir)
    // copy over built-in assets
    await fs.copy(path.join(rootDir, 'src/world/assets'), this.dir)
  }

  async upload(file) {
    // Fail-fast validation: strict asset upload with verification
    if (!file) {
      throw new Error('[assets] FATAL: upload() called with null/undefined file')
    }

    if (!file.name) {
      throw new Error('[assets] FATAL: file missing name property')
    }

    let arrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (error) {
      throw new Error(`[assets] FATAL: Failed to read file "${file.name}": ${error.message}`)
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(`[assets] FATAL: File "${file.name}" has no content (0 bytes)`)
    }

    const buffer = Buffer.from(arrayBuffer)
    const hash = await hashFile(buffer)
    const ext = file.name.split('.').pop().toLowerCase()
    const filename = `${hash}.${ext}`
    const assetPath = path.join(this.dir, filename)

    // Skip if already exists and valid
    const exists = await fs.exists(assetPath)
    if (exists) {
      // Verify existing file integrity
      try {
        const existingBuffer = await fs.readFile(assetPath)
        const existingHash = await hashFile(existingBuffer)
        if (existingHash !== hash) {
          throw new Error(`[assets] FATAL: Hash mismatch for existing asset "${filename}" (corrupted file)`)
        }
        return { filename, skipped: true }
      } catch (error) {
        if (error.message.includes('FATAL')) throw error
        // File exists but can't read - delete and rewrite
        await fs.remove(assetPath)
      }
    }

    // Write asset file
    try {
      await fs.writeFile(assetPath, buffer)
    } catch (error) {
      throw new Error(`[assets] FATAL: Failed to write asset "${filename}": ${error.message}`)
    }

    // CRITICAL: Verify file was actually written correctly
    try {
      const writtenBuffer = await fs.readFile(assetPath)
      if (writtenBuffer.length !== buffer.length) {
        throw new Error(`[assets] FATAL: Asset "${filename}" size mismatch after write (expected ${buffer.length}, got ${writtenBuffer.length})`)
      }

      const writtenHash = await hashFile(writtenBuffer)
      if (writtenHash !== hash) {
        throw new Error(`[assets] FATAL: Asset "${filename}" hash mismatch after write (file corrupted during write)`)
      }
    } catch (error) {
      // Delete corrupted file
      await fs.remove(assetPath).catch(() => {})
      if (error.message.includes('FATAL')) throw error
      throw new Error(`[assets] FATAL: Failed to verify written asset "${filename}": ${error.message}`)
    }

    return { filename, written: true }
  }

  async exists(filename) {
    const filePath = path.join(this.dir, filename)
    const exists = await fs.exists(filePath)
    return exists
  }

  async list() {
    const assets = new Set()
    const files = fs.readdirSync(this.dir)
    for (const file of files) {
      const filePath = path.join(this.dir, file)
      const isDirectory = fs.statSync(filePath).isDirectory()
      if (isDirectory) continue
      const relPath = path.relative(this.dir, filePath)
      // HACK: we only want to include uploaded assets (not core/assets/*) so we do a check
      // if its filename is a 64 character hash
      const isAsset = relPath.split('.')[0].length === 64
      if (!isAsset) continue
      assets.add(relPath)
    }
    return assets
  }

  async delete(assets) {
    for (const asset of assets) {
      const fullPath = path.join(this.dir, asset)
      fs.removeSync(fullPath)
    }
  }
}
