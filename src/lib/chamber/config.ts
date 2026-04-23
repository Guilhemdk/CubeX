import type { BlockDirection } from '../block/blockAsset'

export const SURFACE_CONFIG = {
  width: 7.4,
  depth: 7.4,
  position: [0, -0.48, 0] as [number, number, number],
  gap: 0.000,
  grid: {
    minSize: 0.38,
    maxSize: 0.92,
    stopChance: 0.24,
    seed: 112,
  },
  protrusion: {
    min: 0.12,
    max: 0.29,
    embeddedDepth: 0.68,
  },
} as const

export const SURFACE_INTERACTION_CONFIG = {
  influenceRadius: 1.12,
  falloffPower: 1.0,
  maxDisplacement: 0.29,
  stepBands: 7,
  spring: {
    stiffness: 150,
    damping: 56,
  },
} as const

export const SURFACE_SHADER_CONFIG = {
  // glowColor: '#FFB100', 
  glowColor: '#ff6600',
  // glowColor: '#F2CC7C',
  maxGlowIntensity: 4.35,
  inwardFaceDirection: [0, 1, 0] as BlockDirection,
  enableCoreMask: false,
} as const

export const SURFACE_RENDER_CONFIG = {
  pointerPlaneLift: 0.002,
  settleThreshold: 0.00045,
  maxFrameDelta: 1 / 24,
  castShadow: false,
  receiveShadow: false,
} as const
