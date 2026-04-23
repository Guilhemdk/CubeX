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

export type LightingPresetName = 'dark' | 'noir' | 'preview'

export const LIGHTING_PRESETS = {
  dark: {
    background: '#07090d',
    exposure: 0.28,
    environmentBlur: 0.04,
    ambientIntensity: 0.01,
    hemisphere: {
      skyColor: '#8b93a3',
      groundColor: '#050608',
      intensity: 0.12,
    },
    keyLight: {
      position: [3.6, 4.5, 3.15] as [number, number, number],
      intensity: 1,
    },
    fillLightA: {
      position: [-2.75, 1.25, 4.4] as [number, number, number],
      intensity: 0.18,
    },
    fillLightB: {
      position: [-3.85, 2.8, -2.35] as [number, number, number],
      intensity: 0.08,
    },
  },
  noir: {
    background: '#050609',
    exposure: 0.22,
    environmentBlur: 0.05,
    ambientIntensity: 0.005,
    hemisphere: {
      skyColor: '#7d8798',
      groundColor: '#040507',
      intensity: 0.08,
    },
    keyLight: {
      position: [3.6, 4.5, 3.15] as [number, number, number],
      intensity: 0.8,
    },
    fillLightA: {
      position: [-2.75, 1.25, 4.4] as [number, number, number],
      intensity: 0.12,
    },
    fillLightB: {
      position: [-3.85, 2.8, -2.35] as [number, number, number],
      intensity: 0.05,
    },
  },
  preview: {
    background: '#11141a',
    exposure: 0.45,
    environmentBlur: 0.03,
    ambientIntensity: 0.03,
    hemisphere: {
      skyColor: '#aab4c6',
      groundColor: '#090c12',
      intensity: 0.2,
    },
    keyLight: {
      position: [3.6, 4.5, 3.15] as [number, number, number],
      intensity: 1.3,
    },
    fillLightA: {
      position: [-2.75, 1.25, 4.4] as [number, number, number],
      intensity: 0.3,
    },
    fillLightB: {
      position: [-3.85, 2.8, -2.35] as [number, number, number],
      intensity: 0.12,
    },
  },
} as const

export const LIGHTING_PRESET: LightingPresetName = 'noir'
export const LIGHTING_CONFIG = LIGHTING_PRESETS[LIGHTING_PRESET]

export const SURFACE_GENERATOR_CONFIG = {
  grid: {
    minSize: 0.38,
    maxSize: 0.62,
    stopChance: 0.24,
    seed: 112,
  },
  protrusion: {
    min: 0.12,
    max: 0.20,
    embeddedDepth: 0.002,
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
} as const
