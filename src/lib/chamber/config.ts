import type { BlockDirection } from '../block/blockAsset'
export type ChamberSurfaceId = 'floor' | 'leftWall' | 'rightWall' | 'backWall' | 'ceiling'

export interface ChamberSurfaceDefinition {
  id: ChamberSurfaceId
  width: number
  depth: number
  position: [number, number, number]
  rotation: [number, number, number]
  inwardFaceDirection: BlockDirection
  seed: number
}

export const CHAMBER_CONFIG = {
  width: 5.2,
  depth: 9.4,
  height: 2.6,
  floorY: -0.48,
} as const

export const SURFACE_GENERATOR_CONFIG = {
  gap: 0.000,
  grid: {
    minSize: 0.38,
    maxSize: 0.62,
    stopChance: 0.24,
    seed: 112,
  },
  protrusion: {
    min: 0.12,
    max: 0.20,
    embeddedDepth: 0.28,
  },
} as const
const HALF_WIDTH = CHAMBER_CONFIG.width / 2
const HALF_DEPTH = CHAMBER_CONFIG.depth / 2
const WALL_CENTER_Y = CHAMBER_CONFIG.floorY + CHAMBER_CONFIG.height / 2
const CEILING_Y = CHAMBER_CONFIG.floorY + CHAMBER_CONFIG.height

export const CHAMBER_SURFACES: readonly ChamberSurfaceDefinition[] = [
  {
    id: 'floor',
    width: CHAMBER_CONFIG.width,
    depth: CHAMBER_CONFIG.depth,
    position: [0, CHAMBER_CONFIG.floorY, 0],
    rotation: [0, 0, 0],
    inwardFaceDirection: [0, 1, 0],
    seed: SURFACE_GENERATOR_CONFIG.grid.seed + 0,
  },
  {
    id: 'leftWall',
    width: CHAMBER_CONFIG.height,
    depth: CHAMBER_CONFIG.depth,
    position: [-HALF_WIDTH, WALL_CENTER_Y, 0],
    rotation: [0, 0, -Math.PI / 2],
    inwardFaceDirection: [0, 1, 0],
    seed: SURFACE_GENERATOR_CONFIG.grid.seed + 101,
  },
  {
    id: 'rightWall',
    width: CHAMBER_CONFIG.height,
    depth: CHAMBER_CONFIG.depth,
    position: [HALF_WIDTH, WALL_CENTER_Y, 0],
    rotation: [0, 0, Math.PI / 2],
    inwardFaceDirection: [0, 1, 0],
    seed: SURFACE_GENERATOR_CONFIG.grid.seed + 211,
  },
  {
    id: 'backWall',
    width: CHAMBER_CONFIG.width,
    depth: CHAMBER_CONFIG.height,
    position: [0, WALL_CENTER_Y, -HALF_DEPTH],
    rotation: [Math.PI / 2, 0, 0],
    inwardFaceDirection: [0, 1, 0],
    seed: SURFACE_GENERATOR_CONFIG.grid.seed + 307,
  },
  {
    id: 'ceiling',
    width: CHAMBER_CONFIG.width,
    depth: CHAMBER_CONFIG.depth,
    position: [0, CEILING_Y, 0],
    rotation: [Math.PI, 0, 0],
    inwardFaceDirection: [0, 1, 0],
    seed: SURFACE_GENERATOR_CONFIG.grid.seed + 401,
  },
] as const

export const SURFACE_INTERACTION_CONFIG = {
  influenceRadius: 1.12,
  falloffPower: 1.0,
  maxDisplacement: 0.10,
  stepBands: 7,
  spring: {
    stiffness: 150,
    damping: 56,
  },
} as const

export const SURFACE_SHADER_CONFIG = {
  glowColor: '#ff6600',
  maxGlowIntensity: 4.35,
  enableCoreMask: false,
} as const

export const SURFACE_RENDER_CONFIG = {
  pointerPlaneLift: 0.002,
  settleThreshold: 0.00045,
  maxFrameDelta: 1 / 24,
  castShadow: false,
  receiveShadow: false,
} as const
