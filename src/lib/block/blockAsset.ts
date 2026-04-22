import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  RepeatWrapping,
  Vector3,
  type BufferGeometry,
  type ColorRepresentation,
} from 'three'
import {
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import {
  abs,
  dot,
  float,
  length,
  max as tslMax,
  normalLocal,
  oneMinus,
  positionLocal,
  smoothstep,
  uniform,
  vec2,
} from 'three/tsl'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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

type BlockShellMaterialOptions = {
  glowColor?: ColorRepresentation
  inwardFaceDirection?: BlockDirection
  enableCoreMask?: boolean
}

export type BlockShellGlowState = {
  normalizedDisplacement: number
  glowColor: ColorRepresentation
  maxGlowIntensity: number
  inwardFaceDirection: BlockDirection
  enableCoreMask: boolean
}

export type BlockShellMaterialController = {
  material: MeshStandardNodeMaterial
  setGlowState: (state: BlockShellGlowState) => void
  dispose: () => void
}

function normalizeBlockDirection(direction: BlockDirection, target: Vector3) {
  target.set(direction[0], direction[1], direction[2])

  if (target.lengthSq() === 0) {
    target.set(0, 0, 1)
  }

  target.normalize()
}

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

// function createBlockInnerCoreGeometry(): BufferGeometry {
//   const sourceGeometry = new RoundedBoxGeometry(0.58, 0.58, 0.58, 2, 0.074)
//   const geometry = mergeVertices(sourceGeometry, 1e-5)
//
//   sourceGeometry.dispose()
//   geometry.computeVertexNormals()
//   geometry.computeBoundingBox()
//   geometry.computeBoundingSphere()
//   geometry.name = 'VaultBlockInnerCoreGeometry'
//
//   return geometry
// }

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

export const blockGeometry = createBlockGeometry()
// export const blockInnerCoreGeometry = createBlockInnerCoreGeometry()

export function createBlockShellMaterial(options: BlockShellMaterialOptions = {}): BlockShellMaterialController {
  const initialDirection = new Vector3()
  normalizeBlockDirection(options.inwardFaceDirection ?? [0, 0, 1], initialDirection)

  const glowStrengthUniform = uniform(0)
  const glowColorUniform = uniform(new Color(options.glowColor ?? '#f2f7ff'))
  const inwardDirectionUniform = uniform(initialDirection.clone())
  const coreMaskEnabledUniform = uniform(options.enableCoreMask ? 1 : 0)

  const material = new MeshStandardNodeMaterial({
    color: new Color('#26282f'),
    metalness: 0.96,
    roughness: 0.68,
    roughnessMap: sharedRoughnessMap,
    bumpMap: sharedBumpMap,
    bumpScale: 0.858,
    envMapIntensity: 0.82,
  })

  material.name = 'VaultBlockShellMaterial'
  material.dithering = true

  const localNormal = normalLocal.normalize()
  const normalAbs = abs(localNormal)
  const axisWeightX = smoothstep(float(0.56), float(0.97), normalAbs.x)
  const axisWeightY = smoothstep(float(0.56), float(0.97), normalAbs.y)
  const axisWeightZ = smoothstep(float(0.56), float(0.97), normalAbs.z)
  const axisWeightSum = tslMax(axisWeightX.add(axisWeightY).add(axisWeightZ), float(0.0001))

  const localPosition = positionLocal
  const radiusOnXFace = length(vec2(localPosition.y, localPosition.z)).mul(0.9)
  const radiusOnYFace = length(vec2(localPosition.x, localPosition.z)).mul(0.9)
  const radiusOnZFace = length(vec2(localPosition.x, localPosition.y)).mul(0.9)
  const faceRadius = axisWeightX
    .mul(radiusOnXFace)
    .add(axisWeightY.mul(radiusOnYFace))
    .add(axisWeightZ.mul(radiusOnZFace))
    .div(axisWeightSum)
  const baseFaceRevealMask = float(0.72)
  const coreMask = oneMinus(smoothstep(float(0.0), float(1.38), faceRadius))

  const inwardAlignment = dot(localNormal, inwardDirectionUniform.normalize())
  const inwardFaceSuppression = smoothstep(float(0.72), float(0.98), inwardAlignment)
  const outwardFaceMask = oneMinus(inwardFaceSuppression)
  const emissiveMask = baseFaceRevealMask
    .add(coreMask.mul(0.52).mul(coreMaskEnabledUniform))
    .mul(outwardFaceMask)
    .mul(glowStrengthUniform)

  material.emissiveNode = glowColorUniform.mul(emissiveMask)
  material.emissiveIntensity = 1

  const normalizedDirection = new Vector3()

  const setGlowState = ({
    normalizedDisplacement,
    maxGlowIntensity,
    glowColor,
    inwardFaceDirection,
    enableCoreMask,
  }: BlockShellGlowState) => {
    const clampedDisplacement = Math.max(0, Math.min(1, normalizedDisplacement))
    const scaledStrength = Math.min(clampedDisplacement * (0.18 + maxGlowIntensity * 0.21), 1.45)

    glowStrengthUniform.value = scaledStrength
    glowColorUniform.value.set(glowColor)
    normalizeBlockDirection(inwardFaceDirection, normalizedDirection)
    inwardDirectionUniform.value.copy(normalizedDirection)
    coreMaskEnabledUniform.value = enableCoreMask ? 1 : 0
  }

  return {
    material,
    setGlowState,
    dispose: () => {
      material.dispose()
    },
  }
}

// export function createBlockInnerCoreMaterial(color: ColorRepresentation = '#f2f7ff') {
//   const material = new MeshBasicMaterial({
//     color: new Color(color),
//     transparent: true,
//     opacity: 0,
//     blending: AdditiveBlending,
//     depthWrite: false,
//     depthTest: false,
//     toneMapped: false,
//   })
//
//   material.name = 'VaultBlockInnerCoreMaterial'
//
//   return material
// }

export const blockTextures = {
  roughnessMap: sharedRoughnessMap,
  bumpMap: sharedBumpMap,
}
