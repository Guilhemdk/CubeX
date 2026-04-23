<script lang="ts">
  import { onDestroy } from 'svelte'
  import { T, useTask } from '@threlte/core'
  import {
    DynamicDrawUsage,
    InstancedBufferAttribute,
    InstancedMesh,
    Object3D,
    Plane,
    Vector3,
    type Group,
  } from 'three'
  import {
    blockGeometry,
    createInstancedBlockShellMaterial,
    mapNormalizedDisplacementToGlowStrength,
  } from '../block/blockAsset'
  import {
    SURFACE_INTERACTION_CONFIG,
    SURFACE_RENDER_CONFIG,
    SURFACE_SHADER_CONFIG,
    type ChamberSurfaceDefinition,
  } from '../chamber/config'
  import { createSurfaceLayout } from '../chamber/surfaces/createSurfaceLayout'

  export let surface: ChamberSurfaceDefinition
  export let onDebugChange:
    | ((state: { hovered: boolean; displacement: number }) => void)
    | undefined = undefined

  const layout = createSurfaceLayout({
    width: surface.width,
    depth: surface.depth,
    seed: surface.seed,
  })
  const instanceCount = layout.instances.length
  const surfaceOrigin = new Vector3(...surface.position)
  const surfaceNormal = new Vector3(...surface.inwardFaceDirection)

  if (surfaceNormal.lengthSq() === 0) {
    surfaceNormal.set(0, 1, 0)
  }

  surfaceNormal.normalize()

  const clippingPlane = new Plane(surfaceNormal, -surfaceNormal.dot(surfaceOrigin))
  const glowAttribute = new InstancedBufferAttribute(new Float32Array(instanceCount), 1)
  glowAttribute.setUsage(DynamicDrawUsage)

  const shellMaterialController = createInstancedBlockShellMaterial({
    instanceCount,
    glowAttribute,
    glowColor: SURFACE_SHADER_CONFIG.glowColor,
    inwardFaceDirection: surface.inwardFaceDirection,
    enableCoreMask: SURFACE_SHADER_CONFIG.enableCoreMask,
    clippingPlanes: [clippingPlane],
  })

  shellMaterialController.setSharedState({
    glowColor: SURFACE_SHADER_CONFIG.glowColor,
    inwardFaceDirection: surface.inwardFaceDirection,
    enableCoreMask: SURFACE_SHADER_CONFIG.enableCoreMask,
  })

  const shellMaterial = shellMaterialController.material
  const glowStrengthArray = glowAttribute.array as Float32Array

  let rootGroup: Group | undefined
  let instancedMesh: InstancedMesh | undefined
  let initialized = false
  let pointerActive = false

  const displacement = new Float32Array(instanceCount)
  const velocity = new Float32Array(instanceCount)
  const baseX = new Float32Array(instanceCount)
  const baseY = new Float32Array(instanceCount)
  const baseZ = new Float32Array(instanceCount)
  const scaleX = new Float32Array(instanceCount)
  const scaleY = new Float32Array(instanceCount)
  const scaleZ = new Float32Array(instanceCount)
  const pointerWorld = new Vector3()
  const pointerLocal = new Vector3()
  const transformProxy = new Object3D()

  for (const instance of layout.instances) {
    baseX[instance.index] = instance.basePosition[0]
    baseY[instance.index] = instance.basePosition[1]
    baseZ[instance.index] = instance.basePosition[2]
    scaleX[instance.index] = instance.scale[0]
    scaleY[instance.index] = instance.scale[1]
    scaleZ[instance.index] = instance.scale[2]
  }

  function emitDebugState(maxDisplacement: number) {
    onDebugChange?.({ hovered: pointerActive, displacement: maxDisplacement })
  }

  function setPointerPoint(point: Vector3) {
    if (!rootGroup) return

    pointerWorld.copy(point)
    pointerLocal.copy(pointerWorld)
    rootGroup.worldToLocal(pointerLocal)
    pointerActive = true
    animationTask.start()
  }

  function clearPointer() {
    pointerActive = false
    animationTask.start()
  }

  function handlePointerMove(event: { point: Vector3 }) {
    setPointerPoint(event.point)
  }

  function handlePointerLeave() {
    clearPointer()
  }

  function writeInstanceMatrix(index: number, displacementOffset: number) {
    if (!instancedMesh) return

    transformProxy.position.set(baseX[index], baseY[index] + displacementOffset, baseZ[index])
    transformProxy.rotation.set(0, 0, 0)
    transformProxy.scale.set(scaleX[index], scaleY[index], scaleZ[index])
    transformProxy.updateMatrix()
    instancedMesh.setMatrixAt(index, transformProxy.matrix)
  }

  function initializeInstances() {
    if (!instancedMesh || initialized) return

    instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage)

    for (let index = 0; index < instanceCount; index += 1) {
      displacement[index] = 0
      velocity[index] = 0
      glowStrengthArray[index] = 0
      writeInstanceMatrix(index, 0)
    }

    instancedMesh.instanceMatrix.needsUpdate = true
    glowAttribute.needsUpdate = true
    emitDebugState(0)
    initialized = true
  }

  const animationTask = useTask(
    (delta) => {
      if (!instancedMesh || !initialized) return

      const dt = Math.min(delta, SURFACE_RENDER_CONFIG.maxFrameDelta)
      const pointerX = pointerLocal.x
      const pointerZ = pointerLocal.z
      const dampingFactor = Math.exp(-SURFACE_INTERACTION_CONFIG.spring.damping * dt)
      let maxFrameDisplacement = 0
      let hasMotion = false

      for (let index = 0; index < instanceCount; index += 1) {
        const dx = baseX[index] - pointerX
        const dz = baseZ[index] - pointerZ
        const distance = Math.hypot(dx, dz)
        const normalizedInfluence = pointerActive
          ? Math.max(0, 1 - distance / SURFACE_INTERACTION_CONFIG.influenceRadius)
          : 0
        const easedInfluence = normalizedInfluence ** SURFACE_INTERACTION_CONFIG.falloffPower
        const steppedInfluence =
          SURFACE_INTERACTION_CONFIG.stepBands > 1
            ? Math.ceil(easedInfluence * SURFACE_INTERACTION_CONFIG.stepBands) /
              SURFACE_INTERACTION_CONFIG.stepBands
            : easedInfluence
        const targetDisplacement = steppedInfluence * SURFACE_INTERACTION_CONFIG.maxDisplacement
        const springForce = (targetDisplacement - displacement[index]) * SURFACE_INTERACTION_CONFIG.spring.stiffness

        velocity[index] += springForce * dt
        velocity[index] *= dampingFactor
        displacement[index] += velocity[index] * dt

        if (
          Math.abs(targetDisplacement - displacement[index]) < SURFACE_RENDER_CONFIG.settleThreshold &&
          Math.abs(velocity[index]) < SURFACE_RENDER_CONFIG.settleThreshold
        ) {
          displacement[index] = targetDisplacement
          velocity[index] = 0
        } else {
          hasMotion = true
        }

        const normalizedDisplacement =
          SURFACE_INTERACTION_CONFIG.maxDisplacement > 0
            ? Math.max(0, Math.min(1, displacement[index] / SURFACE_INTERACTION_CONFIG.maxDisplacement))
            : 0

        glowStrengthArray[index] = mapNormalizedDisplacementToGlowStrength(
          normalizedDisplacement,
          SURFACE_SHADER_CONFIG.maxGlowIntensity,
        )
        writeInstanceMatrix(index, displacement[index])

        if (displacement[index] > maxFrameDisplacement) {
          maxFrameDisplacement = displacement[index]
        }
      }

      instancedMesh.instanceMatrix.needsUpdate = true
      glowAttribute.needsUpdate = true
      emitDebugState(maxFrameDisplacement)

      if (!pointerActive && !hasMotion) {
        animationTask.stop()
      }
    },
    {
      autoStart: false,
    },
  )

  $: if (instancedMesh && !initialized) {
    initializeInstances()
  }

  onDestroy(() => {
    shellMaterialController.dispose()
  })
</script>

<T.Group
  position={surface.position}
  rotation={surface.rotation}
  bind:ref={rootGroup}
>
  <T.Mesh
    rotation={[-Math.PI / 2, 0, 0]}
    position={[0, SURFACE_RENDER_CONFIG.pointerPlaneLift, 0]}
    onpointerenter={handlePointerMove}
    onpointermove={handlePointerMove}
    onpointerleave={handlePointerLeave}
    onpointerout={handlePointerLeave}
  >
    <T.PlaneGeometry args={[layout.surfaceWidth, layout.surfaceDepth]} />
    <T.MeshBasicMaterial transparent={true} opacity={0} colorWrite={false} depthWrite={false} />
  </T.Mesh>

  <T.InstancedMesh
    args={[blockGeometry, shellMaterial, instanceCount]}
    bind:ref={instancedMesh}
    castShadow={SURFACE_RENDER_CONFIG.castShadow}
    receiveShadow={SURFACE_RENDER_CONFIG.receiveShadow}
    onpointerenter={handlePointerMove}
    onpointermove={handlePointerMove}
    onpointerleave={handlePointerLeave}
    onpointerout={handlePointerLeave}
  />
</T.Group>
