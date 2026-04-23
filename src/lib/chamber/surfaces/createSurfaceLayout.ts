import { SURFACE_GENERATOR_CONFIG } from '../config'
import { generateRecursiveSurfaceGrid } from '../generators/recursiveSurfaceGrid'

export interface SurfaceLayoutInstance {
  index: number
  basePosition: [number, number, number]
  scale: [number, number, number]
  protrusion: number
}

export interface SurfaceLayout {
  instances: SurfaceLayoutInstance[]
  surfaceWidth: number
  surfaceDepth: number
  maxProtrusion: number
}

export interface SurfaceLayoutInput {
  width: number
  depth: number
  seed: number
}

export function createSurfaceLayout(input: SurfaceLayoutInput): SurfaceLayout {
  const grid = generateRecursiveSurfaceGrid({
    surfaceWidth: input.width,
    surfaceDepth: input.depth,
    minSize: SURFACE_GENERATOR_CONFIG.grid.minSize,
    maxSize: SURFACE_GENERATOR_CONFIG.grid.maxSize,
    protrusionMin: SURFACE_GENERATOR_CONFIG.protrusion.min,
    protrusionMax: SURFACE_GENERATOR_CONFIG.protrusion.max,
    gap: SURFACE_GENERATOR_CONFIG.gap,
    stopChance: SURFACE_GENERATOR_CONFIG.grid.stopChance,
    seed: input.seed,
  })

  const embeddedDepth = SURFACE_GENERATOR_CONFIG.protrusion.embeddedDepth
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
    surfaceWidth: input.width,
    surfaceDepth: input.depth,
    maxProtrusion: SURFACE_GENERATOR_CONFIG.protrusion.max,
  }
}
