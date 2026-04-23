type Rect = {
  x: number
  z: number
  w: number
  d: number
}

export interface SurfaceCell {
  cx: number
  cz: number
  width: number
  depth: number
  protrusion: number
  index: number
}

export interface RecursiveSurfaceGridConfig {
  surfaceWidth: number
  surfaceDepth: number
  minSize: number
  maxSize: number
  protrusionMin: number
  protrusionMax: number
  stopChance: number
  seed: number
}

export interface SurfaceGridResult {
  cells: SurfaceCell[]
}

function createRng(seed: number) {
  if (seed === 0) {
    return Math.random
  }

  let state = (seed >>> 0) || 1

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

export function generateRecursiveSurfaceGrid(config: RecursiveSurfaceGridConfig): SurfaceGridResult {
  const rng = createRng(config.seed)
  const cells: SurfaceCell[] = []
  let nextIndex = 0
  const maxSplitDepth = 64

  const emitCell = (rect: Rect) => {
    cells.push({
      cx: rect.x + rect.w / 2 - config.surfaceWidth / 2,
      cz: rect.z + rect.d / 2 - config.surfaceDepth / 2,
      width: Math.max(rect.w, 0.04),
      depth: Math.max(rect.d, 0.04),
      protrusion: config.protrusionMin + rng() * (config.protrusionMax - config.protrusionMin),
      index: nextIndex++,
    })
  }

  const subdivide = (rect: Rect, depthLevel: number) => {
    const canSplitX = rect.w > config.minSize * 2
    const canSplitZ = rect.d > config.minSize * 2
    const mustSplitX = rect.w > config.maxSize
    const mustSplitZ = rect.d > config.maxSize
    const mustSplit = mustSplitX || mustSplitZ
    const canSplit = canSplitX || canSplitZ

    if (depthLevel >= maxSplitDepth || (!mustSplit && (!canSplit || rng() < config.stopChance))) {
      emitCell(rect)
      return
    }

    let splitAlongX = false

    if (mustSplitX && !mustSplitZ) splitAlongX = true
    else if (mustSplitZ && !mustSplitX) splitAlongX = false
    else if (canSplitX && !canSplitZ) splitAlongX = true
    else if (canSplitZ && !canSplitX) splitAlongX = false
    else splitAlongX = rect.w / rect.d > 0.9 + rng() * 0.4

    if (splitAlongX) {
      const minT = config.minSize / rect.w
      const maxT = 1 - minT
      const t = minT + rng() * (maxT - minT)
      const splitX = rect.x + rect.w * t

      subdivide({ x: rect.x, z: rect.z, w: rect.w * t, d: rect.d }, depthLevel + 1)
      subdivide({ x: splitX, z: rect.z, w: rect.w * (1 - t), d: rect.d }, depthLevel + 1)
      return
    }

    const minT = config.minSize / rect.d
    const maxT = 1 - minT
    const t = minT + rng() * (maxT - minT)
    const splitZ = rect.z + rect.d * t

    subdivide({ x: rect.x, z: rect.z, w: rect.w, d: rect.d * t }, depthLevel + 1)
    subdivide({ x: rect.x, z: splitZ, w: rect.w, d: rect.d * (1 - t) }, depthLevel + 1)
  }

  subdivide({ x: 0, z: 0, w: config.surfaceWidth, d: config.surfaceDepth }, 0)
  return { cells }
}
