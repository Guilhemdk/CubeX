import { SURFACE_CONFIG } from '../config'
import { generateRecursiveSurfaceGrid } from '../generators/recursiveSurfaceGrid'

export interface FloorSurfaceInstance {
  index: number
  basePosition: [number, number, number]
  scale: [number, number, number]
  protrusion: number
}

export interface FloorSurfaceLayout {
  instances: FloorSurfaceInstance[]
  surfaceWidth: number
  surfaceDepth: number
  maxProtrusion: number
}

export function createFloorSurfaceLayout(): FloorSurfaceLayout {
  const grid = generateRecursiveSurfaceGrid({
    surfaceWidth: SURFACE_CONFIG.width,
    surfaceDepth: SURFACE_CONFIG.depth,
    minSize: SURFACE_CONFIG.grid.minSize,
    maxSize: SURFACE_CONFIG.grid.maxSize,
    protrusionMin: SURFACE_CONFIG.protrusion.min,
    protrusionMax: SURFACE_CONFIG.protrusion.max,
    gap: SURFACE_CONFIG.gap,
    stopChance: SURFACE_CONFIG.grid.stopChance,
    seed: SURFACE_CONFIG.grid.seed,
  })

  const embeddedDepth = SURFACE_CONFIG.protrusion.embeddedDepth
  const instances = grid.cells.map((cell) => {
    const fullHeight = embeddedDepth + cell.protrusion
    const centerY = (cell.protrusion - embeddedDepth) / 2

    return {
      index: cell.index,
      basePosition: [cell.cx, centerY, cell.cz] as [number, number, number],
      scale: [cell.width, fullHeight, cell.depth] as [number, number, number],
      protrusion: cell.protrusion,
    }
  })

  return {
    instances,
    surfaceWidth: SURFACE_CONFIG.width,
    surfaceDepth: SURFACE_CONFIG.depth,
    maxProtrusion: SURFACE_CONFIG.protrusion.max,
  }
}                       
