import {
  AdditiveBlending,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  type ColorRepresentation,
  type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const BLOCK_DIMENSIONS = Object.freeze([1, 1, 1] as const)
export const BLOCK_BEVEL_RADIUS = 0.028
export const BLOCK_BEVEL_SEGMENTS = 1
export type BlockDirection = [number, number, number]

type BrushTextureOptions = {
  seed: number
  size?: number
  base: number
  contrast: number
  speckle: number
  repeat: number
}

type GlowGeometryOptions = {
  panelOffset?: number
  panelScale?: number
}

const sideGlowGeometryCache = new Map<string, BufferGeometry>()

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function blur(values: Float32Array, passes = 2) {
  for (let pass = 0; pass < passes; pass += 1) {
    const snapshot = values.slice()

    for (let index = 0; index < values.length; index += 1) {
      const previous = snapshot[(index - 1 + snapshot.length) % snapshot.length]
      const current = snapshot[index]
      const next = snapshot[(index + 1) % snapshot.length]

      values[index] = previous * 0.24 + current * 0.52 + next * 0.24
    }
  }

  return values
}

function buildNoiseBand(length: number, seed: number, jitter: number, smoothing: number, blurPasses: number) {
  const rng = createSeededRandom(seed)
  const values = new Float32Array(length)
  let current = rng() - 0.5

  for (let index = 0; index < length; index += 1) {
    current = current * smoothing + (rng() - 0.5) * jitter
    values[index] = current
  }

  return blur(values, blurPasses)
}

function createBrushedTexture({
  seed,
  size = 256,
  base,
  contrast,
  speckle,
  repeat,
}: BrushTextureOptions) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Failed to create 2D canvas context for procedural block texture.')
  }

  const image = context.createImageData(size, size)
  const data = image.data
  const rng = createSeededRandom(seed)
  const macroColumns = buildNoiseBand(size, seed + 11, 0.18, 0.93, 5)
  const microColumns = buildNoiseBand(size, seed + 29, 0.42, 0.56, 2)
  const rowBands = buildNoiseBand(size, seed + 47, 0.22, 0.8, 3)

  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1)
    const rowWave = Math.sin(v * Math.PI * 12 + 0.65) * 3.2
    const rowLift = rowBands[y] * contrast * 0.14

    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1)
      const centeredU = Math.abs(u - 0.5)
      const centeredV = Math.abs(v - 0.5)
      const streak = macroColumns[x] * contrast + microColumns[x] * contrast * 0.58
      const grain = (rng() - 0.5) * speckle
      const falloff = (centeredU + centeredV) * 12
      const value = Math.max(0, Math.min(255, Math.round(base + streak + rowWave + rowLift + grain - falloff)))
      const pixel = (y * size + x) * 4

      data[pixel + 0] = value
      data[pixel + 1] = value
      data[pixel + 2] = value
      data[pixel + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true

  return texture
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))

  return t * t * (3 - 2 * t)
}

function createGlowMaskTexture(size = 192) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Failed to create glow mask texture for the modular block.')
  }

  const image = context.createImageData(size, size)
  const data = image.data

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1)
      const v = y / (size - 1)
      const distanceToEdge = Math.min(u, 1 - u, v, 1 - v)
      const crispBorder = 1 - smoothstep(0.028, 0.11, distanceToEdge)
      const softBorder = 1 - smoothstep(0.05, 0.28, distanceToEdge)
      const alpha = Math.max(0, Math.min(1, crispBorder * 1.1 + softBorder * 0.48))
      const value = Math.round(alpha * 255)
      const pixel = (y * size + x) * 4

      data[pixel + 0] = value
      data[pixel + 1] = value
      data[pixel + 2] = value
      data[pixel + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true

  return texture
}

function getDominantAxis(direction: BlockDirection) {
  const [x, y, z] = direction
  const magnitudes = [Math.abs(x), Math.abs(y), Math.abs(z)]

  if (magnitudes[0] >= magnitudes[1] && magnitudes[0] >= magnitudes[2]) {
    return 0
  }

  if (magnitudes[1] >= magnitudes[2]) {
    return 1
  }

  return 2
}

function createGlowPanel(axis: number, sign: -1 | 1, panelScale: number, panelOffset: number) {
  const geometry = new PlaneGeometry(panelScale, panelScale)
  const surfacePosition = 0.5 + panelOffset

  if (axis === 0) {
    geometry.rotateY(sign === 1 ? Math.PI / 2 : -Math.PI / 2)
    geometry.translate(sign * surfacePosition, 0, 0)
  } else if (axis === 1) {
    geometry.rotateX(sign === 1 ? -Math.PI / 2 : Math.PI / 2)
    geometry.translate(0, sign * surfacePosition, 0)
  } else {
    geometry.rotateY(sign === 1 ? 0 : Math.PI)
    geometry.translate(0, 0, sign * surfacePosition)
  }

  return geometry
}

function createBlockGeometry(): BufferGeometry {
  const sourceGeometry = new RoundedBoxGeometry(
    BLOCK_DIMENSIONS[0],
    BLOCK_DIMENSIONS[1],
    BLOCK_DIMENSIONS[2],
    BLOCK_BEVEL_SEGMENTS,
    BLOCK_BEVEL_RADIUS,
  )
  const geometry = mergeVertices(sourceGeometry, 1e-5)

  sourceGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'VaultBlockGeometry'

  return geometry
}

const sharedRoughnessMap = createBrushedTexture({
  seed: 17,
  base: 152,
  contrast: 94,
  speckle: 15,
  repeat: 1.5,
})

const sharedBumpMap = createBrushedTexture({
  seed: 73,
  base: 127,
  contrast: 94,
  speckle: 5,
  repeat: 1.65,
})
const sharedGlowMask = createGlowMaskTexture()

export const blockGeometry = createBlockGeometry()

export function createBlockMaterial() {
  const material = new MeshStandardMaterial({
    color: new Color('#26282f'),
    metalness: 0.96,
    roughness: 0.68,
    roughnessMap: sharedRoughnessMap,
    bumpMap: sharedBumpMap,
    bumpScale: 0.858,
    envMapIntensity: 0.82,
  })

  material.name = 'VaultBlockMaterial'
  material.dithering = true

  return material
}

export function getBlockGlowGeometry(
  inwardFaceDirection: BlockDirection = [0, 0, 1],
  options: GlowGeometryOptions = {},
) {
  const panelScale = options.panelScale ?? 0.985
  const panelOffset = options.panelOffset ?? 0.01
  const dominantAxis = getDominantAxis(inwardFaceDirection)
  const cacheKey = `${dominantAxis}:${panelScale}:${panelOffset}`
  const cachedGeometry = sideGlowGeometryCache.get(cacheKey)

  if (cachedGeometry) {
    return cachedGeometry
  }

  const geometries = [0, 1, 2]
    .filter((axis) => axis !== dominantAxis)
    .flatMap((axis) => [
      createGlowPanel(axis, 1, panelScale, panelOffset),
      createGlowPanel(axis, -1, panelScale, panelOffset),
    ])
  const mergedGeometry = mergeGeometries(geometries, false)

  if (!mergedGeometry) {
    throw new Error('Failed to build the block glow geometry.')
  }

  geometries.forEach((geometry) => geometry.dispose())
  mergedGeometry.computeVertexNormals()
  mergedGeometry.computeBoundingBox()
  mergedGeometry.computeBoundingSphere()
  mergedGeometry.name = `VaultBlockGlowGeometry-${cacheKey}`
  sideGlowGeometryCache.set(cacheKey, mergedGeometry)

  return mergedGeometry
}

export function createBlockGlowMaterial(color: ColorRepresentation = '#f1f6ff') {
  const material = new MeshBasicMaterial({
    color: new Color(color),
    alphaMap: sharedGlowMask,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  })

  material.name = 'VaultBlockGlowMaterial'

  return material
}

export const blockMaterial = createBlockMaterial()

export const blockTextures = {
  roughnessMap: sharedRoughnessMap,
  bumpMap: sharedBumpMap,
  glowMask: sharedGlowMask,
}
