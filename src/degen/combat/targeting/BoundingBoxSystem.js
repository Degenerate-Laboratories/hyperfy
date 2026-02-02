/**
 * BoundingBoxSystem - Pure Math Bounding Box Collision Detection
 *
 * 100% testable AABB (Axis-Aligned Bounding Box) math with ZERO THREE.js dependencies.
 * All ray-box intersection calculations are pure functions.
 *
 * v33 Problem: Tight coupling to THREE.js Mesh creation made collision untestable.
 * v34 Solution: Extract pure AABB math into this class, inject rendering at runtime.
 */

export class BoundingBoxSystem {
  constructor() {
    this.boxes = new Map() // entityId → box data
  }

  /**
   * Creates a bounding box for an entity
   * @param {string} entityId - Entity identifier
   * @param {Object} dimensions - Box dimensions {width, height, depth}
   * @param {Object} position - Box center position {x, y, z}
   * @returns {Object} - Box data structure
   */
  createBox(entityId, dimensions, position) {
    const box = {
      entityId,
      min: {
        x: position.x - dimensions.width / 2,
        y: position.y,
        z: position.z - dimensions.depth / 2,
      },
      max: {
        x: position.x + dimensions.width / 2,
        y: position.y + dimensions.height,
        z: position.z + dimensions.depth / 2,
      },
      center: { ...position },
      dimensions: { ...dimensions },
    }
    this.boxes.set(entityId, box)
    return box
  }

  /**
   * Updates bounding box position (entity moved)
   * @param {string} entityId - Entity identifier
   * @param {Object} position - New position {x, y, z}
   * @returns {Object|null} - Updated box or null if not found
   */
  updateBoxPosition(entityId, position) {
    const box = this.boxes.get(entityId)
    if (!box) return null

    const halfWidth = box.dimensions.width / 2
    const halfDepth = box.dimensions.depth / 2

    box.min.x = position.x - halfWidth
    box.min.y = position.y
    box.min.z = position.z - halfDepth

    box.max.x = position.x + halfWidth
    box.max.y = position.y + box.dimensions.height
    box.max.z = position.z + halfDepth

    box.center = { ...position }

    return box
  }

  /**
   * Removes a bounding box
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - True if removed, false if not found
   */
  removeBox(entityId) {
    return this.boxes.delete(entityId)
  }

  /**
   * Tests if a ray intersects a bounding box (AABB slab method)
   * @param {Object} box - Bounding box {min, max}
   * @param {Object} ray - Ray {origin, direction}
   * @returns {boolean} - True if ray hits box
   */
  boxIntersectsRay(box, ray) {
    // Ray-AABB intersection using slab method
    // https://tavianator.com/2011/ray_box.html
    let tmin = -Infinity
    let tmax = Infinity

    // X axis
    if (ray.direction.x !== 0) {
      const tx1 = (box.min.x - ray.origin.x) / ray.direction.x
      const tx2 = (box.max.x - ray.origin.x) / ray.direction.x
      tmin = Math.max(tmin, Math.min(tx1, tx2))
      tmax = Math.min(tmax, Math.max(tx1, tx2))
    } else {
      // Ray parallel to X axis
      if (ray.origin.x < box.min.x || ray.origin.x > box.max.x) {
        return false
      }
    }

    // Y axis
    if (ray.direction.y !== 0) {
      const ty1 = (box.min.y - ray.origin.y) / ray.direction.y
      const ty2 = (box.max.y - ray.origin.y) / ray.direction.y
      tmin = Math.max(tmin, Math.min(ty1, ty2))
      tmax = Math.min(tmax, Math.max(ty1, ty2))
    } else {
      // Ray parallel to Y axis
      if (ray.origin.y < box.min.y || ray.origin.y > box.max.y) {
        return false
      }
    }

    // Z axis
    if (ray.direction.z !== 0) {
      const tz1 = (box.min.z - ray.origin.z) / ray.direction.z
      const tz2 = (box.max.z - ray.origin.z) / ray.direction.z
      tmin = Math.max(tmin, Math.min(tz1, tz2))
      tmax = Math.min(tmax, Math.max(tz1, tz2))
    } else {
      // Ray parallel to Z axis
      if (ray.origin.z < box.min.z || ray.origin.z > box.max.z) {
        return false
      }
    }

    // Ray intersects if tmax >= tmin and tmax >= 0
    return tmax >= Math.max(0, tmin)
  }

  /**
   * Calculates exact intersection point and distance
   * @param {Object} box - Bounding box {min, max}
   * @param {Object} ray - Ray {origin, direction}
   * @returns {Object|null} - Intersection {x, y, z, distance} or null
   */
  getIntersectionPoint(box, ray) {
    if (!this.boxIntersectsRay(box, ray)) return null

    // Calculate intersection distance (t parameter)
    let tmin = -Infinity

    // X axis
    if (ray.direction.x !== 0) {
      const tx1 = (box.min.x - ray.origin.x) / ray.direction.x
      const tx2 = (box.max.x - ray.origin.x) / ray.direction.x
      tmin = Math.max(tmin, Math.min(tx1, tx2))
    }

    // Y axis
    if (ray.direction.y !== 0) {
      const ty1 = (box.min.y - ray.origin.y) / ray.direction.y
      const ty2 = (box.max.y - ray.origin.y) / ray.direction.y
      tmin = Math.max(tmin, Math.min(ty1, ty2))
    }

    // Z axis
    if (ray.direction.z !== 0) {
      const tz1 = (box.min.z - ray.origin.z) / ray.direction.z
      const tz2 = (box.max.z - ray.origin.z) / ray.direction.z
      tmin = Math.max(tmin, Math.min(tz1, tz2))
    }

    // Ensure we're hitting the front of the box
    const t = Math.max(0, tmin)

    // Calculate intersection point
    return {
      x: ray.origin.x + ray.direction.x * t,
      y: ray.origin.y + ray.direction.y * t,
      z: ray.origin.z + ray.direction.z * t,
      distance: t,
    }
  }

  /**
   * Raycasts against all bounding boxes, returns sorted hits
   * @param {Object} ray - Ray {origin, direction}
   * @returns {Array} - Array of hits sorted by distance (closest first)
   */
  raycastAll(ray) {
    const hits = []

    for (const [entityId, box] of this.boxes) {
      const intersection = this.getIntersectionPoint(box, ray)
      if (intersection) {
        hits.push({
          entityId,
          box,
          point: intersection,
          distance: intersection.distance,
        })
      }
    }

    // Sort by distance (closest first)
    hits.sort((a, b) => a.distance - b.distance)

    return hits
  }

  /**
   * Gets a bounding box by entity ID
   * @param {string} entityId - Entity identifier
   * @returns {Object|undefined} - Box or undefined
   */
  getBox(entityId) {
    return this.boxes.get(entityId)
  }

  /**
   * Gets all bounding boxes
   * @returns {Array} - Array of all boxes
   */
  getAllBoxes() {
    return Array.from(this.boxes.values())
  }
}
