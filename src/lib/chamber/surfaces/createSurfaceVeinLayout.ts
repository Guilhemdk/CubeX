import { Euler, Quaternion, Vector3 } from 'three'
import { CHAMBER_CONFIG, SURFACE_VEIN_CONFIG, type ChamberSurfaceDefinition } from '../config'
import type { SurfaceLayoutInstance } from './createSurfaceLayout'

type FaceDirection = [number, number, number]

type SurfaceNode = {
  index: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  canonicalX: number
  canonicalZ: number
  distanceToTarget: number
  neighbors: number[]
}

type ScoredNeighbor = {
  index: number
  score: number
  directionX: number
  directionZ: number
}

export interface SurfaceVeinLayoutInput {
  surface: ChamberSurfaceDefinition
  instances: SurfaceLayoutInstance[]
}

export interface SurfaceVeinLayout {
  staticGlow: Float32Array
  primaryFaces: Float32Array
  secondaryFaces: Float32Array
}

const ADJACENCY_EPSILON = 0.006
const MIN_TOUCH_OVERLAP = 0.03
const BACK_WALL_CENTER_WORLD = new Vector3(
  0,
  CHAMBER_CONFIG.floorY + CHAMBER_CONFIG.height / 2,
  -CHAMBER_CONFIG.depth / 2,
)

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function overlaps(aMin: number, aMax: number, bMin: number, bMax: number) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin)
}

function getFaceOffset(index: number) {
  return index * 3
}

function readFace(buffer: Float32Array, index: number): FaceDirection {
  const offset = getFaceOffset(index)
  return [buffer[offset], buffer[offset + 1], buffer[offset + 2]]
}

function writeFace(buffer: Float32Array, index: number, face: FaceDirection) {
  const offset = getFaceOffset(index)
  buffer[offset] = face[0]
  buffer[offset + 1] = face[1]
  buffer[offset + 2] = face[2]
}

function isZeroFace(face: FaceDirection) {
  return face[0] === 0 && face[1] === 0 && face[2] === 0
}

function areFacesEqual(a: FaceDirection, b: FaceDirection) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function storeFace(
  primaryFaces: Float32Array,
  secondaryFaces: Float32Array,
  index: number,
  face: FaceDirection,
) {
  const primaryFace = readFace(primaryFaces, index)
  if (areFacesEqual(primaryFace, face)) {
    return
  }

  if (isZeroFace(primaryFace)) {
    writeFace(primaryFaces, index, face)
    return
  }

  const secondaryFace = readFace(secondaryFaces, index)
  if (areFacesEqual(secondaryFace, face)) {
    return
  }

  if (isZeroFace(secondaryFace)) {
    writeFace(secondaryFaces, index, face)
  }
}

function negateFace(face: FaceDirection): FaceDirection {
  return [-face[0], -face[1], -face[2]]
}

function toCanonicalX(surface: ChamberSurfaceDefinition, value: number) {
  return surface.id === 'rightWall' ? -value : value
}

function fromCanonicalFace(surface: ChamberSurfaceDefinition, face: FaceDirection): FaceDirection {
  if (surface.id === 'rightWall') {
    return [-face[0], face[1], face[2]]
  }

  return face
}

function resolveVeinSeed(surface: ChamberSurfaceDefinition) {
  if (surface.id === 'leftWall' || surface.id === 'rightWall') {
    return SURFACE_VEIN_CONFIG.sideWallSymmetrySeed
  }

  return surface.seed + SURFACE_VEIN_CONFIG.seedOffset
}

function projectBackWallCenterToSurfaceLocal(surface: ChamberSurfaceDefinition) {
  const orientation = new Quaternion().setFromEuler(
    new Euler(surface.rotation[0], surface.rotation[1], surface.rotation[2], 'XYZ'),
  )
  const xAxis = new Vector3(1, 0, 0).applyQuaternion(orientation)
  const zAxis = new Vector3(0, 0, 1).applyQuaternion(orientation)
  const origin = new Vector3(surface.position[0], surface.position[1], surface.position[2])
  const toBackCenter = BACK_WALL_CENTER_WORLD.clone().sub(origin)

  return {
    x: toBackCenter.dot(xAxis),
    z: toBackCenter.dot(zAxis),
  }
}

function buildNodes(
  surface: ChamberSurfaceDefinition,
  instances: SurfaceLayoutInstance[],
  targetX: number,
  targetZ: number,
) {
  const nodes = new Array<SurfaceNode>(instances.length)

  for (const instance of instances) {
    const x = instance.basePosition[0]
    const z = instance.basePosition[2]
    const width = instance.scale[0]
    const depth = instance.scale[2]
    const minX = x - width / 2
    const maxX = x + width / 2
    const minZ = z - depth / 2
    const maxZ = z + depth / 2
    const canonicalX = toCanonicalX(surface, x)
    const canonicalZ = z

    nodes[instance.index] = {
      index: instance.index,
      minX,
      maxX,
      minZ,
      maxZ,
      canonicalX,
      canonicalZ,
      distanceToTarget: Math.hypot(canonicalX - targetX, canonicalZ - targetZ),
      neighbors: [],
    }
  }

  return nodes
}

function buildAdjacency(nodes: SurfaceNode[]) {
  for (let aIndex = 0; aIndex < nodes.length; aIndex += 1) {
    const a = nodes[aIndex]

    for (let bIndex = aIndex + 1; bIndex < nodes.length; bIndex += 1) {
      const b = nodes[bIndex]
      const touchOnX =
        Math.abs(a.maxX - b.minX) <= ADJACENCY_EPSILON ||
        Math.abs(b.maxX - a.minX) <= ADJACENCY_EPSILON
      const touchOnZ =
        Math.abs(a.maxZ - b.minZ) <= ADJACENCY_EPSILON ||
        Math.abs(b.maxZ - a.minZ) <= ADJACENCY_EPSILON
      const overlapOnZ = overlaps(a.minZ, a.maxZ, b.minZ, b.maxZ)
      const overlapOnX = overlaps(a.minX, a.maxX, b.minX, b.maxX)

      const adjacent =
        (touchOnX && overlapOnZ >= MIN_TOUCH_OVERLAP) ||
        (touchOnZ && overlapOnX >= MIN_TOUCH_OVERLAP)

      if (adjacent) {
        a.neighbors.push(b.index)
        b.neighbors.push(a.index)
      }
    }
  }
}

function selectTargetNodeIndex(nodes: SurfaceNode[], targetX: number, targetZ: number) {
  let selectedIndex = nodes[0]?.index ?? 0
  let selectedDistance = Number.POSITIVE_INFINITY

  for (const node of nodes) {
    const distance = Math.hypot(node.canonicalX - targetX, node.canonicalZ - targetZ)

    if (distance < selectedDistance) {
      selectedDistance = distance
      selectedIndex = node.index
    }
  }

  return selectedIndex
}

function pickBranchStartIndices(
  surface: ChamberSurfaceDefinition,
  nodes: SurfaceNode[],
  targetNodeIndex: number,
  branchCount: number,
  rng: () => number,
) {
  const minStartDistance = Math.max(Math.min(surface.width, surface.depth) * 0.24, 0.36)
  const spacing = Math.max(Math.min(surface.width, surface.depth) * SURFACE_VEIN_CONFIG.startSpacingRatio, 0.28)
  const candidates = [...nodes]
    .filter((node) => node.index !== targetNodeIndex && node.distanceToTarget >= minStartDistance)
    .sort((left, right) => right.distanceToTarget - left.distanceToTarget)
  const starts: number[] = []

  for (const candidate of candidates) {
    if (starts.length >= branchCount) {
      break
    }

    const farEnough = starts.every((existingIndex) => {
      const existing = nodes[existingIndex]
      const distance = Math.hypot(
        candidate.canonicalX - existing.canonicalX,
        candidate.canonicalZ - existing.canonicalZ,
      )
      return distance >= spacing
    })

    if (farEnough || rng() > 0.87) {
      starts.push(candidate.index)
    }
  }

  if (starts.length < branchCount) {
    for (const candidate of candidates) {
      if (starts.length >= branchCount) {
        break
      }

      if (!starts.includes(candidate.index)) {
        starts.push(candidate.index)
      }
    }
  }

  return starts
}

function scoreNeighbors(
  current: SurfaceNode,
  nodes: SurfaceNode[],
  neighborIndices: number[],
  localVisited: Set<number>,
  globalVisits: Uint16Array,
  previousDirectionX: number,
  previousDirectionZ: number,
  previousDirectionMagnitude: number,
  rng: () => number,
): ScoredNeighbor[] {
  const neighbors: ScoredNeighbor[] = []

  for (const neighborIndex of neighborIndices) {
    const neighbor = nodes[neighborIndex]
    const deltaX = neighbor.canonicalX - current.canonicalX
    const deltaZ = neighbor.canonicalZ - current.canonicalZ
    const deltaLength = Math.hypot(deltaX, deltaZ) || 1
    const directionX = deltaX / deltaLength
    const directionZ = deltaZ / deltaLength
    const backtrackPenalty =
      neighbor.distanceToTarget > current.distanceToTarget ? SURFACE_VEIN_CONFIG.backtrackPenalty : 0
    const revisitPenalty = localVisited.has(neighborIndex) ? SURFACE_VEIN_CONFIG.revisitPenalty : 0
    const turnPenalty =
      previousDirectionMagnitude > 0
        ? (1 - (directionX * previousDirectionX + directionZ * previousDirectionZ)) *
          SURFACE_VEIN_CONFIG.turnPenalty
        : 0
    const trunkAttractor =
      globalVisits[neighborIndex] > 0
        ? -Math.min(globalVisits[neighborIndex] * SURFACE_VEIN_CONFIG.trunkAttractor, 0.46)
        : 0
    const jitter = (rng() - 0.5) * SURFACE_VEIN_CONFIG.jitter
    const score =
      neighbor.distanceToTarget +
      backtrackPenalty +
      revisitPenalty +
      turnPenalty +
      trunkAttractor +
      jitter

    neighbors.push({
      index: neighborIndex,
      score,
      directionX,
      directionZ,
    })
  }

  neighbors.sort((left, right) => left.score - right.score)
  return neighbors
}

function traceBranch(
  startNodeIndex: number,
  targetNodeIndex: number,
  nodes: SurfaceNode[],
  globalVisits: Uint16Array,
  rng: () => number,
) {
  const path = [startNodeIndex]
  const localVisited = new Set<number>(path)
  const maxSteps = Math.max(10, Math.floor(nodes.length * SURFACE_VEIN_CONFIG.maxPathStepRatio))
  let previousDirectionX = 0
  let previousDirectionZ = 0
  let previousDirectionMagnitude = 0
  let previousDistance = nodes[startNodeIndex].distanceToTarget
  let stalledSteps = 0

  for (let step = 0; step < maxSteps; step += 1) {
    const currentNodeIndex = path[path.length - 1]
    if (currentNodeIndex === targetNodeIndex) {
      break
    }

    const currentNode = nodes[currentNodeIndex]
    if (currentNode.neighbors.length === 0) {
      break
    }

    const scoredNeighbors = scoreNeighbors(
      currentNode,
      nodes,
      currentNode.neighbors,
      localVisited,
      globalVisits,
      previousDirectionX,
      previousDirectionZ,
      previousDirectionMagnitude,
      rng,
    )

    if (scoredNeighbors.length === 0) {
      break
    }

    const branchPoolSize = Math.max(
      1,
      Math.min(SURFACE_VEIN_CONFIG.branchPoolSize, scoredNeighbors.length),
    )
    const selectionPool = scoredNeighbors.slice(0, branchPoolSize)
    const selectedNeighbor = selectionPool[Math.floor(rng() * selectionPool.length)]

    path.push(selectedNeighbor.index)
    localVisited.add(selectedNeighbor.index)

    if (selectedNeighbor.index === targetNodeIndex) {
      break
    }

    previousDirectionX = selectedNeighbor.directionX
    previousDirectionZ = selectedNeighbor.directionZ
    previousDirectionMagnitude = 1

    const selectedDistance = nodes[selectedNeighbor.index].distanceToTarget
    if (selectedDistance + 1e-4 >= previousDistance) {
      stalledSteps += 1
      if (stalledSteps >= 4) {
        break
      }
    } else {
      stalledSteps = 0
    }
    previousDistance = selectedDistance
  }

  return path
}

function resolveSegmentFace(fromNode: SurfaceNode, toNode: SurfaceNode): FaceDirection {
  const deltaX = toNode.canonicalX - fromNode.canonicalX
  const deltaZ = toNode.canonicalZ - fromNode.canonicalZ

  if (Math.abs(deltaX) >= Math.abs(deltaZ)) {
    return deltaX >= 0 ? [1, 0, 0] : [-1, 0, 0]
  }

  return deltaZ >= 0 ? [0, 0, 1] : [0, 0, -1]
}

export function createSurfaceVeinLayout({ surface, instances }: SurfaceVeinLayoutInput): SurfaceVeinLayout {
  const instanceCount = instances.length
  const staticGlow = new Float32Array(instanceCount)
  const primaryFaces = new Float32Array(instanceCount * 3)
  const secondaryFaces = new Float32Array(instanceCount * 3)

  if (instanceCount === 0) {
    return {
      staticGlow,
      primaryFaces,
      secondaryFaces,
    }
  }

  const projectedTarget = projectBackWallCenterToSurfaceLocal(surface)
  const targetX = toCanonicalX(surface, projectedTarget.x)
  const targetZ = projectedTarget.z
  const nodes = buildNodes(surface, instances, targetX, targetZ)

  buildAdjacency(nodes)

  const targetNodeIndex = selectTargetNodeIndex(nodes, targetX, targetZ)
  const rng = createRng(resolveVeinSeed(surface))
  const globalVisits = new Uint16Array(instanceCount)
  const branchCount = Math.max(1, SURFACE_VEIN_CONFIG.branchCounts[surface.id])
  const startNodeIndices = pickBranchStartIndices(
    surface,
    nodes,
    targetNodeIndex,
    branchCount,
    rng,
  )

  for (const startNodeIndex of startNodeIndices) {
    const path = traceBranch(startNodeIndex, targetNodeIndex, nodes, globalVisits, rng)
    if (path.length < 2) {
      continue
    }

    for (const visitedNodeIndex of path) {
      globalVisits[visitedNodeIndex] += 1
    }

    for (let step = 0; step < path.length - 1; step += 1) {
      const fromNode = nodes[path[step]]
      const toNode = nodes[path[step + 1]]
      const canonicalFace = resolveSegmentFace(fromNode, toNode)
      const outgoingFace = fromCanonicalFace(surface, canonicalFace)
      const incomingFace = negateFace(outgoingFace)

      storeFace(primaryFaces, secondaryFaces, fromNode.index, outgoingFace)
      storeFace(primaryFaces, secondaryFaces, toNode.index, incomingFace)
    }
  }

  const maxDistanceToTarget = Math.max(...nodes.map((node) => node.distanceToTarget), 0.0001)
  const centerBoostRadius = Math.max(
    Math.min(surface.width, surface.depth) * SURFACE_VEIN_CONFIG.staticGlow.centerBoostRadius,
    0.18,
  )

  for (const node of nodes) {
    const primaryFace = readFace(primaryFaces, node.index)
    const secondaryFace = readFace(secondaryFaces, node.index)
    const hasFace = !isZeroFace(primaryFace) || !isZeroFace(secondaryFace)

    if (!hasFace) {
      continue
    }

    const distanceFactor = 1 - clamp(node.distanceToTarget / maxDistanceToTarget, 0, 1)
    const visitFactor = Math.max(0, globalVisits[node.index] - 1)
    const centerDistance = Math.hypot(node.canonicalX - targetX, node.canonicalZ - targetZ)
    const centerBoostFactor = clamp(1 - centerDistance / centerBoostRadius, 0, 1)
    const baseGlow =
      SURFACE_VEIN_CONFIG.staticGlow.min +
      distanceFactor * (SURFACE_VEIN_CONFIG.staticGlow.max - SURFACE_VEIN_CONFIG.staticGlow.min)
    const trunkBoost = Math.min(visitFactor * SURFACE_VEIN_CONFIG.staticGlow.trunkBoost, 0.28)
    const centerBoost = centerBoostFactor * SURFACE_VEIN_CONFIG.staticGlow.centerBoost

    staticGlow[node.index] = clamp(baseGlow + trunkBoost + centerBoost, 0, 1.4)
  }

  return {
    staticGlow,
    primaryFaces,
    secondaryFaces,
  }
}
