<script lang="ts">
  import { onDestroy } from 'svelte'
  import { T, useTask } from '@threlte/core'
  import { Color, Group, MathUtils, Vector3, type ColorRepresentation, type Material } from 'three'
  import {
    blockGeometry,
    blockMaterial,
    createBlockGlowMaterial,
    getBlockGlowGeometry,
    type BlockDirection,
  } from '../block/blockAsset'

  export let position: [number, number, number] = [0, 0, 0]
  export let rotation: [number, number, number] = [0, 0, 0]
  export let scale: number | [number, number, number] = 1
  export let material: Material | Material[] = blockMaterial
  export let castShadow = true
  export let receiveShadow = true
  export let interactive = true
  export let extractionDistance = 0.14
  export let springStiffness = 190
  export let springDamping = 18
  export let maxGlowIntensity = 4.1
  export let glowColor: ColorRepresentation = '#edf4ff'
  export let inwardFaceDirection: BlockDirection = [0, 0, 1]

  let resolvedScale: [number, number, number] = [1, 1, 1]
  let movingGroup: Group | undefined
  let hovered = false
  let currentDisplacement = 0
  let springVelocity = 0
  let glowGeometry = getBlockGlowGeometry(inwardFaceDirection)
  const motionDirection = new Vector3()
  const workingOffset = new Vector3()
  const baseGlowColor = new Color(glowColor)
  const glowMaterial = createBlockGlowMaterial(glowColor)
  const settleThreshold = 0.0005

  $: resolvedScale = Array.isArray(scale) ? ([...scale] as [number, number, number]) : [scale, scale, scale]
  $: glowGeometry = getBlockGlowGeometry(inwardFaceDirection)
  $: {
    motionDirection.set(...inwardFaceDirection)

    if (motionDirection.lengthSq() === 0) {
      motionDirection.set(0, 0, 1)
    }

    motionDirection.normalize()
  }
  $: baseGlowColor.set(glowColor)

  function handlePointerEnter() {
    if (!interactive) return

    hovered = true
  }

  function handlePointerLeave() {
    hovered = false
  }

  useTask(
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
      }

      const normalizedDisplacement =
        extractionDistance > 0 ? MathUtils.clamp(currentDisplacement / extractionDistance, 0, 1) : 0

      if (movingGroup) {
        workingOffset.copy(motionDirection).multiplyScalar(currentDisplacement)
        movingGroup.position.copy(workingOffset)
      }

      glowMaterial.opacity = normalizedDisplacement * 0.96
      glowMaterial.color.copy(baseGlowColor).multiplyScalar(0.42 + normalizedDisplacement * maxGlowIntensity)
    },
    {
      running: () =>
        Math.abs((interactive && hovered ? extractionDistance : 0) - currentDisplacement) > settleThreshold ||
        Math.abs(springVelocity) > settleThreshold,
    },
  )

  onDestroy(() => {
    glowMaterial.dispose()
  })
</script>

<T.Group
  {position}
  {rotation}
  scale={resolvedScale}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
>
  <T.Group bind:ref={movingGroup}>
    <T.Mesh geometry={blockGeometry} {material} {castShadow} {receiveShadow} />
    <T.Mesh geometry={glowGeometry} material={glowMaterial} renderOrder={1} />
  </T.Group>
</T.Group>
