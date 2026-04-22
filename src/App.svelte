<script lang="ts">
  import { Canvas } from '@threlte/core'
  import { WebGPURenderer } from 'three/webgpu'
  import BlockScene from './lib/components/BlockScene.svelte'

  const dpr = typeof window === 'undefined' ? 1.25 : Math.min(window.devicePixelRatio, 2)
  let renderMode: 'manual' | 'on-demand' = 'manual'
  let rendererReady = false
  let blockHovered = false
  let blockDisplacement = 0

  function handleBlockDebugChange(state: { hovered: boolean; displacement: number }) {
    blockHovered = state.hovered
    blockDisplacement = state.displacement
  }

  function createRenderer(canvas: HTMLCanvasElement) {
    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      forceWebGL: false,
    })

    renderer
      .init()
      .then(() => {
        rendererReady = true
        renderMode = 'on-demand'
      })
      .catch((error) => {
        console.error('Failed to initialize WebGPURenderer.', error)
      })

    return renderer
  }
</script>

<svelte:head>
  <title>Vault Block Showcase</title>
  <meta
    name="description"
    content="Standalone Threlte study of a modular brushed-metal block optimized for future instancing."
  />
</svelte:head>

<main class="page">
  <section class="viewport" aria-label="Studio render of the modular block asset">
    <Canvas colorSpace="srgb" shadows={true} {renderMode} {dpr} {createRenderer}>
      {#if rendererReady}
        <BlockScene onDebugChange={handleBlockDebugChange} />
      {/if}
    </Canvas>
    <aside class="debug-overlay" aria-live="polite">
      <div class="debug-title">Block Debug</div>
      <div class="debug-row">
        <span>hovered</span>
        <span class:debug-true={blockHovered}>{blockHovered ? 'true' : 'false'}</span>
      </div>
      <div class="debug-row">
        <span>displacement</span>
        <span>{blockDisplacement.toFixed(4)}</span>
      </div>
    </aside>
  </section>
</main>
