/**
 * worldToScreen utility
 *
 * Converts 3D world position to 2D screen coordinates
 * Adapted for v35 camera and renderer APIs
 *
 * NOTE: This is a simplified implementation. May need adjustment
 * based on actual v35 camera.worldToScreen API if it exists.
 */

import * as THREE from 'three'

/**
 * Convert world position to screen coordinates
 * @param {Object} world - World instance
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @param {number} z - World Z position
 * @returns {{x: number, y: number}|null} Screen position or null if behind camera
 */
export function worldToScreen(world, x, y, z) {
  if (!world?.camera || !world?.graphics?.renderer) {
    return null
  }

  try {
    const camera = world.camera
    const renderer = world.graphics.renderer

    // Create vector at world position
    const vector = new THREE.Vector3(x, y, z)

    // Project to screen space
    vector.project(camera)

    // Check if behind camera
    if (vector.z > 1) {
      return null
    }

    // Convert NDC (-1 to +1) to screen coordinates
    const widthHalf = renderer.domElement.width / 2
    const heightHalf = renderer.domElement.height / 2

    const screenX = (vector.x * widthHalf) + widthHalf
    const screenY = -(vector.y * heightHalf) + heightHalf

    return {
      x: screenX,
      y: screenY
    }
  } catch (error) {
    console.error('[worldToScreen] Error:', error)
    return null
  }
}

/**
 * Check if position is visible on screen
 * @param {Object} world - World instance
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @param {number} z - World Z position
 * @returns {boolean} True if visible
 */
export function isOnScreen(world, x, y, z) {
  const screenPos = worldToScreen(world, x, y, z)
  if (!screenPos) return false

  const renderer = world.graphics.renderer
  if (!renderer) return false

  const { width, height } = renderer.domElement

  return (
    screenPos.x >= 0 &&
    screenPos.x <= width &&
    screenPos.y >= 0 &&
    screenPos.y <= height
  )
}
