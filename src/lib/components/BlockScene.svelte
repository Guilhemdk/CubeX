<script lang="ts">
  import { onMount } from 'svelte'
  import { T, useThrelte } from '@threlte/core'
  import { OrbitControls, interactivity } from '@threlte/extras'
  import * as THREE from 'three'
  import { PMREMGenerator } from 'three/webgpu'
  import type { WebGPURenderer } from 'three/webgpu'
  import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js'
  import type { PerspectiveCamera } from 'three'
  import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
  import { LIGHTING_CONFIG } from '../chamber/config'
  import Chamber from './Chamber.svelte'

  export let controls = false
  export let onDebugChange:
    | ((state: { hovered: boolean; displacement: number }) => void)
    | undefined = undefined

  const { renderer, scene, toneMapping } = useThrelte<WebGPURenderer>()
  interactivity()
  const background = new THREE.Color(LIGHTING_CONFIG.background)
  let orbitControls: OrbitControlsImpl | undefined

  function configureCamera(camera: PerspectiveCamera) {
    camera.lookAt(0, 0.4, 0)
  }

  function configureControls() {
    if (!orbitControls) return

    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.08
    orbitControls.enablePan = false
    orbitControls.minDistance = 2.15
    orbitControls.maxDistance = 4.2
    orbitControls.minPolarAngle = 0.82
    orbitControls.maxPolarAngle = 1.58
    orbitControls.minAzimuthAngle = -1.1
    orbitControls.maxAzimuthAngle = 1.1
    orbitControls.target.set(0, -0.14, 0)
    orbitControls.update()
  }


  onMount(() => {
    toneMapping.set(THREE.ACESFilmicToneMapping)
    renderer.toneMappingExposure = LIGHTING_CONFIG.exposure
    ;(renderer as unknown as { localClippingEnabled: boolean }).localClippingEnabled = true
    scene.background = background

    const pmrem = new PMREMGenerator(renderer)
    const roomEnvironment = new RoomEnvironment()
    const environmentTarget = pmrem.fromScene(roomEnvironment, LIGHTING_CONFIG.environmentBlur)

    scene.environment = environmentTarget.texture

    return () => {
      scene.environment = null
      scene.background = null
      environmentTarget.dispose()
      roomEnvironment.dispose()
      pmrem.dispose()
    }
  })

  $: configureControls()
</script>

<T.PerspectiveCamera
  makeDefault
  position={[0, 0.5, 7.25]}
  fov={28}
  near={0.1}
  far={30}
  oncreate={configureCamera}
>
  {#if controls}
    <OrbitControls bind:ref={orbitControls} />
  {/if}
</T.PerspectiveCamera>

<T.AmbientLight intensity={LIGHTING_CONFIG.ambientIntensity} />
<T.HemisphereLight
  args={[
    LIGHTING_CONFIG.hemisphere.skyColor,
    LIGHTING_CONFIG.hemisphere.groundColor,
    LIGHTING_CONFIG.hemisphere.intensity,
  ]}
/>
<T.DirectionalLight
  position={LIGHTING_CONFIG.keyLight.position}
  intensity={LIGHTING_CONFIG.keyLight.intensity}
/>
<T.DirectionalLight position={LIGHTING_CONFIG.fillLightA.position} intensity={LIGHTING_CONFIG.fillLightA.intensity} />
<T.DirectionalLight position={LIGHTING_CONFIG.fillLightB.position} intensity={LIGHTING_CONFIG.fillLightB.intensity} />

<Chamber {onDebugChange} />
