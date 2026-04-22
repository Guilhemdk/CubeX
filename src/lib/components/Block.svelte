<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { T, useTask } from '@threlte/core'
  import { Color, Group, MathUtils, Vector3, type ColorRepresentation, type Mesh } from 'three'
  import {
    blockGeometry,
    // blockInnerCoreGeometry,
    // createBlockInnerCoreMaterial,
    createBlockShellMaterial,
    type BlockDirection,
  } from '../block/blockAsset'

  export let position: [number, number, number] = [0, 0, 0]
  export let rotation: [number, number, number] = [0, 0, 0]
  export let scale: number | [number, number, number] = 1
  export let castShadow = true
  export let receiveShadow = true
  export let interactive = true
  export let extractionDistance = 0.14
  export let springStiffness = 190
  export let springDamping = 18
  export let maxGlowIntensity = 4.1
  export let glowColor: ColorRepresentation = '#edf4ff'
  export let inwardFaceDirection: BlockDirection = [0, 0, 1]
  export let onDebugChange:
    | ((state: { hovered: boolean; displacement: number }) => void)
    | undefined = undefined

  let resolvedScale: [number, number, number] = [1, 1, 1]
  let movingGroup: Group | undefined
  let hovered = false
  let currentDisplacement = 0
  let springVelocity = 0
  const motionDirection = new Vector3()
  const workingOffset = new Vector3()
  const coreBaseColor = new Color(glowColor)
  const shellMaterialController = createBlockShellMaterial({ glowColor, inwardFaceDirection })
  const shellMaterial = shellMaterialController.material
  // const coreMaterial = createBlockInnerCoreMaterial(glowColor)
  const settleThreshold = 0.0005

  $: resolvedScale = Array.isArray(scale) ? ([...scale] as [number, number, number]) : [scale, scale, scale]
  $: {
    motionDirection.set(...inwardFaceDirection)

    if (motionDirection.lengthSq() === 0) {
      motionDirection.set(0, 0, 1)
    }

    motionDirection.normalize()
  }
  $: coreBaseColor.set(glowColor)

  function emitDebugState() {
    onDebugChange?.({ hovered, displacement: currentDisplacement })
  }

  function handlePointerEnter() {
    if (!interactive) return

    hovered = true
    emitDebugState()
    animationTask.start()
  }

  function handlePointerLeave() {
    hovered = false
    emitDebugState()
    animationTask.start()
  }
  function disableRaycast(mesh: Mesh) {
    mesh.raycast = () => {}
  }

  function applyGlowState(normalizedDisplacement: number) {
    shellMaterialController.setGlowState({
      normalizedDisplacement,
      glowColor,
      maxGlowIntensity,
      inwardFaceDirection,
    })

    const scaledCoreIntensity = normalizedDisplacement * Math.min(0.28 + maxGlowIntensity * 0.16, 1.35)
    // coreMaterial.opacity = scaledCoreIntensity * 0.64
    // coreMaterial.color.copy(coreBaseColor).multiplyScalar(0.42 + scaledCoreIntensity * 1.95)
  }

  const animationTask = useTask(
    (delta) => {
      const dt = Math.min(delta, 1 / 20)
      const targetDisplacement = interactive && hovered ? extractionDistance : 0
      const springForce = (targetDisplacement - currentDisplacement) * springStiffness

      springVelocity += springForce * dt
      springVelocity *= Math.exp(-springDamping * dt)
      currentDisplacement += springVelocity * dt

      if (
        Math.abs(targetDisplacement - currentDisplacement) < settleThreshold &&
        Math.abs(springVelocity) < settleThreshold
      ) {
        currentDisplacement = targetDisplacement
        springVelocity = 0
        animationTask.stop()
      }

      const normalizedDisplacement =
        extractionDistance > 0 ? MathUtils.clamp(currentDisplacement / extractionDistance, 0, 1) : 0

      if (movingGroup) {
        workingOffset.copy(motionDirection).multiplyScalar(currentDisplacement)
        movingGroup.position.copy(workingOffset)
      }
      applyGlowState(normalizedDisplacement)
      emitDebugState()
    },
    {
      autoStart: false,
    },
  )

  onMount(() => {
    applyGlowState(0)
    emitDebugState()
  })

  onDestroy(() => {
    shellMaterialController.dispose()
    // coreMaterial.dispose()
  })
</script>

<T.Group
  {position}
  {rotation}
  scale={resolvedScale}
>
  <T.Group bind:ref={movingGroup}>
    <T.Mesh
      geometry={blockGeometry}
      material={shellMaterial}
      {castShadow}
      {receiveShadow}
      onpointerenter={handlePointerEnter}
      onpointerleave={handlePointerLeave}
      onpointerover={handlePointerEnter}
      onpointerout={handlePointerLeave}
    />
    <!-- <T.Mesh -->
      <!-- geometry={blockInnerCoreGeometry} -->
      <!-- material={coreMaterial} -->
    <!--   castShadow={false} -->
    <!--   receiveShadow={false} -->
    <!--   renderOrder={1} -->
    <!--   oncreate={disableRaycast} -->
    <!-- /> -->
  </T.Group>
</T.Group>
