<script lang="ts">
  import { onMount } from 'svelte'
  import { T, useThrelte } from '@threlte/core'
  import { OrbitControls, interactivity } from '@threlte/extras'
  import * as THREE from 'three'
  import { PMREMGenerator } from 'three/webgpu'
  import type { WebGPURenderer } from 'three/webgpu'
  import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js'
  import type { DirectionalLight, PerspectiveCamera } from 'three'
  import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
  import Block from './Block.svelte'

  export let controls = true
  export let onDebugChange:
    | ((state: { hovered: boolean; displacement: number }) => void)
    | undefined = undefined

  const { renderer, scene, toneMapping } = useThrelte<WebGPURenderer>()
  interactivity()
  const background = new THREE.Color('#d7d1ca')
  let orbitControls: OrbitControlsImpl | undefined

  function configureCamera(camera: PerspectiveCamera) {
    camera.lookAt(0, 0.02, 0)
  }

  function configureControls() {
    if (!orbitControls) return

    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.08
    orbitControls.enablePan = false
    orbitControls.minDistance = 1.85
    orbitControls.maxDistance = 3.5
    orbitControls.minPolarAngle = 0.9
    orbitControls.maxPolarAngle = 1.6
    orbitControls.minAzimuthAngle = -1.1
    orbitControls.maxAzimuthAngle = 1.1
    orbitControls.target.set(0, 0.02, 0)
    orbitControls.update()
  }

  function configureKeyLight(light: DirectionalLight) {
    light.shadow.mapSize.setScalar(1024)
    light.shadow.bias = -0.00035
    light.shadow.normalBias = 0.02
    light.shadow.camera.near = 0.5
    light.shadow.camera.far = 16
    light.shadow.camera.left = -2.4
    light.shadow.camera.right = 2.4
    light.shadow.camera.top = 2.4
    light.shadow.camera.bottom = -2.4
    light.shadow.camera.updateProjectionMatrix()
  }

  onMount(() => {
    toneMapping.set(THREE.ACESFilmicToneMapping)
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    scene.background = background

    const pmrem = new PMREMGenerator(renderer)
    const roomEnvironment = new RoomEnvironment()
    const environmentTarget = pmrem.fromScene(roomEnvironment, 0.04)

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
  position={[1.9, 1.1, 2.25]}
  fov={28}
  near={0.1}
  far={30}
  oncreate={configureCamera}
>
  {#if controls}
    <OrbitControls bind:ref={orbitControls} />
  {/if}
</T.PerspectiveCamera>

<T.AmbientLight intensity={0.24} />
<T.HemisphereLight args={['#fffdf7', '#b7b0a9', 0.94]} />
<T.DirectionalLight
  position={[3.6, 4.5, 3.15]}
  intensity={2.45}
  castShadow={true}
  oncreate={configureKeyLight}
/>
<T.DirectionalLight position={[-2.75, 1.25, 4.4]} intensity={0.82} />
<T.DirectionalLight position={[-3.85, 2.8, -2.35]} intensity={0.34} />

<T.Mesh position={[0, -0.505, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={true}>
  <T.PlaneGeometry args={[8, 8]} />
  <T.ShadowMaterial transparent={true} opacity={0.18} />
</T.Mesh>

<Block
  position={[0, 0, 0]}
  rotation={[0.03, -Math.PI / 4, 0]}
  inwardFaceDirection={[0, 0, 1]}
  enableCoreMask={false}
  extractionDistance={0.16}
  springStiffness={200}
  springDamping={19}
  maxGlowIntensity={4.35}
  glowColor="#FFF1DB"
  {onDebugChange}
/>
