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

export interface SurfaceGapEdge {
  x1: number
  z1: number
  x2: number
  z2: number
}

export interface RecursiveSurfaceGridConfig {
  surfaceWidth: number
  surfaceDepth: number
  minSize: number
  maxSize: number
  protrusionMin: number
  protrusionMax: number
  gap: number
  stopChance: number
  seed: number
}

export interface SurfaceGridResult {
  cells: SurfaceCell[]
  gaps: SurfaceGapEdge[]
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

function clampGapForCell(width: number, depth: number, gap: number) {
  return Math.min(gap, width * 0.45, depth * 0.45)
}

export function generateRecursiveSurfaceGrid(config: RecursiveSurfaceGridConfig): SurfaceGridResult {
  const rng = createRng(config.seed)
  const cells: SurfaceCell[] = []
  const gaps: SurfaceGapEdge[] = []
  let nextIndex = 0

  const maxSplitDepth = 64

  const emitCell = (rect: Rect) => {
    const clampedGap = clampGapForCell(rect.w, rect.d, config.gap)
    const width = Math.max(rect.w - clampedGap, 0.04)
    const depth = Math.max(rect.d - clampedGap, 0.04)
    const protrusion =
      config.protrusionMin + rng() * (config.protrusionMax - config.protrusionMin)

    cells.push({
      cx: rect.x + rect.w / 2 - config.surfaceWidth / 2,
      cz: rect.z + rect.d / 2 - config.surfaceDepth / 2,
      width,
      depth,
      protrusion,
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

      gaps.push({
        x1: splitX,
        z1: rect.z,
        x2: splitX,
        z2: rect.z + rect.d,
      })

      subdivide({ x: rect.x, z: rect.z, w: rect.w * t, d: rect.d }, depthLevel + 1)
      subdivide(
        {
          x: splitX,
          z: rect.z,
          w: rect.w * (1 - t),
          d: rect.d,
        },
        depthLevel + 1,
      )
      return
    }

    const minT = config.minSize / rect.d
    const maxT = 1 - minT
    const t = minT + rng() * (maxT - minT)
    const splitZ = rect.z + rect.d * t

    gaps.push({
      x1: rect.x,
      z1: splitZ,
      x2: rect.x + rect.w,
      z2: splitZ,
    })

    subdivide({ x: rect.x, z: rect.z, w: rect.w, d: rect.d * t }, depthLevel + 1)
    subdivide(
      {
        x: rect.x,
        z: splitZ,
        w: rect.w,
        d: rect.d * (1 - t),
      },
      depthLevel + 1,
    )
  }

  gaps.push({ x1: 0, z1: 0, x2: config.surfaceWidth, z2: 0 })
  gaps.push({ x1: 0, z1: config.surfaceDepth, x2: config.surfaceWidth, z2: config.surfaceDepth })
  gaps.push({ x1: 0, z1: 0, x2: 0, z2: config.surfaceDepth })
  gaps.push({ x1: config.surfaceWidth, z1: 0, x2: config.surfaceWidth, z2: config.surfaceDepth })

  subdivide({ x: 0, z: 0, w: config.surfaceWidth, d: config.surfaceDepth }, 0)

  return { cells, gaps }
}
