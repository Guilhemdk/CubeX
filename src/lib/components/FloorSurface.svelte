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
    SURFACE_CONFIG,
  } from '../chamber/config'
  import { createFloorSurfaceLayout } from '../chamber/floor/createFloorSurfaceLayout'

  export let onDebugChange:
    | ((state: { hovered: boolean; displacement: number }) => void)
    | undefined = undefined

  const layout = createFloorSurfaceLayout()
  const instanceCount = layout.instances.length
  const clippingPlane = new Plane(new Vector3(0, 1, 0), -SURFACE_CONFIG.position[1])
  const glowAttribute = new InstancedBufferAttribute(new Float32Array(instanceCount), 1)
  glowAttribute.setUsage(DynamicDrawUsage)

  const shellMaterialController = createInstancedBlockShellMaterial({
    instanceCount,
    glowAttribute,
    glowColor: SURFACE_SHADER_CONFIG.glowColor,
    inwardFaceDirection: [0, 1, 0],
    enableCoreMask: SURFACE_SHADER_CONFIG.enableCoreMask,
    clippingPlanes: [clippingPlane],
  })

  shellMaterialController.setSharedState({
    glowColor: SURFACE_SHADER_CONFIG.glowColor,
    inwardFaceDirection: SURFACE_SHADER_CONFIG.inwardFaceDirection,
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
  const pointerWorld = new Vector3()
  const pointerLocal = new Vector3()
  const transformProxy = new Object3D()

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

    const instance = layout.instances[index]
    transformProxy.position.set(
      instance.basePosition[0],
      instance.basePosition[1] + displacementOffset,
      instance.basePosition[2],
    )
    transformProxy.rotation.set(0, 0, 0)
    transformProxy.scale.set(instance.scale[0], instance.scale[1], instance.scale[2])
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
      let maxFrameDisplacement = 0
      let hasMotion = false

      for (let index = 0; index < instanceCount; index += 1) {
        const instance = layout.instances[index]
        const dx = instance.basePosition[0] - pointerX
        const dz = instance.basePosition[2] - pointerZ
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
        velocity[index] *= Math.exp(-SURFACE_INTERACTION_CONFIG.spring.damping * dt)
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
  position={SURFACE_CONFIG.position}
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
  />
</T.Group>
