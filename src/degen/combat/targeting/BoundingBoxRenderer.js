/**
 * BoundingBoxRenderer - THREE.js Mesh Rendering for Bounding Boxes
 *
 * Creates actual THREE.Mesh objects with visible wireframe debug boxes
 * Inserts into octree for raycasting
 * Updates positions every frame
 *
 * v33 Problem: Tight coupling made this untestable
 * v34 Solution: Separate renderer from math logic (BoundingBoxSystem)
 */

import * as THREE from '../../../core/extras/three.js'

export class BoundingBoxRenderer {
  constructor(world, boundingBoxSystem) {
    this.world = world
    this.boxes = boundingBoxSystem
    this.meshes = new Map() // entityId -> THREE.Mesh
    this.octreeItems = new Map() // entityId -> octree item
  }

  /**
   * Initialize renderer (called after stage is ready)
   */
  init() {
    if (!this.world.stage?.octree) {
      console.error('❌ Octree not available - raycasting will fail!')
      return
    }
    if (!this.world.stage?.scene) {
      console.error('❌ Scene not available - cannot add meshes!')
      return
    }

    // Listen for entity events
    this.world.entities.on('added', this.onEntityAdded.bind(this))
    this.world.entities.on('removed', this.onEntityRemoved.bind(this))
  }

  /**
   * Create visible mesh for bounding box
   */
  createMesh(entityId, dimensions, position) {
    // Create box geometry with entity dimensions (3x larger for easier clicking)
    const scale = 3.0
    const geometry = new THREE.BoxGeometry(
      dimensions.width * scale,
      dimensions.height * scale,
      dimensions.depth * scale
    )

    // CRITICAL: Compute bounding sphere for octree
    geometry.computeBoundingSphere()

    // Debug material - GREEN WIREFRAME (visible in-game)
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Green
      wireframe: true, // Wireframe for debug visualization
      transparent: true,
      opacity: 0.3, // Semi-transparent
      depthTest: true,
      depthWrite: true,
    })

    const mesh = new THREE.Mesh(geometry, material)

    // Add metadata
    mesh.name = `BoundingBox_${entityId}`
    mesh.visible = true // Explicitly visible for debugging
    mesh.renderOrder = 999 // Render on top

    // Set position
    mesh.position.set(position.x, position.y + dimensions.height / 2, position.z)
    mesh.updateMatrixWorld(true)

    // Add to scene
    this.world.stage.scene.add(mesh)

    // Store mesh
    this.meshes.set(entityId, mesh)

    // Insert into octree for raycasting
    this.insertIntoOctree(entityId, mesh, geometry)

    return mesh
  }

  /**
   * Insert mesh into octree for raycasting
   */
  insertIntoOctree(entityId, mesh, geometry) {
    // Find the actual entity
    const entity = this.world.entities.get(entityId)
    if (!entity) {
      console.warn(`⚠️ Entity ${entityId} not found for octree insertion`)
      return
    }

    // Create octree item (same structure as v33)
    const octreeItem = {
      matrix: mesh.matrixWorld,
      geometry: geometry,
      material: mesh.material,
      getEntity: () => entity, // Return entity when raycast hits
      node: mesh,
    }

    this.world.stage.octree.insert(octreeItem)
    this.octreeItems.set(entityId, octreeItem)
  }

  /**
   * Update mesh position (called every frame)
   */
  updateMeshPosition(entityId, position) {
    const mesh = this.meshes.get(entityId)
    if (!mesh) return

    // Get box from BoundingBoxSystem
    const box = this.boxes.getBox(entityId)
    if (!box) return

    // Update mesh position (centered on bounding box)
    mesh.position.set(
      position.x,
      position.y + box.dimensions.height / 2,
      position.z
    )
    mesh.updateMatrixWorld(true)

    // CRITICAL: Notify octree that this item moved (required for raycasting!)
    const octreeItem = this.octreeItems.get(entityId)
    if (octreeItem) {
      this.world.stage.octree.move(octreeItem)
    }
  }

  /**
   * Remove mesh and octree item
   */
  removeMesh(entityId) {
    // Remove from octree
    const octreeItem = this.octreeItems.get(entityId)
    if (octreeItem) {
      this.world.stage.octree.remove(octreeItem)
      this.octreeItems.delete(entityId)
    }

    // Remove mesh from scene
    const mesh = this.meshes.get(entityId)
    if (mesh) {
      this.world.stage.scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
      this.meshes.delete(entityId)
    }
  }

  /**
   * Handle entity added
   */
  onEntityAdded(entity) {
    // Will be handled by TargetingManager
  }

  /**
   * Handle entity removed
   */
  onEntityRemoved(entity) {
    if (entity?.data?.id) {
      this.removeMesh(entity.data.id)
    }
  }

  /**
   * Update all mesh positions (called every frame)
   */
  updateAll() {
    for (const [entityId, mesh] of this.meshes) {
      const entity = this.world.entities.get(entityId)
      if (!entity) continue

      // Get position from entity
      const positionSource = entity.root || entity.base
      if (!positionSource?.position) continue

      this.updateMeshPosition(entityId, positionSource.position)
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    // Remove all meshes
    for (const entityId of this.meshes.keys()) {
      this.removeMesh(entityId)
    }

    this.world.entities.off('added', this.onEntityAdded)
    this.world.entities.off('removed', this.onEntityRemoved)
  }
}
