<script lang="ts">
  import { CHAMBER_SURFACES } from '../chamber/config'
  import ChamberSurface from './ChamberSurface.svelte'

  export let onDebugChange:
    | ((state: { hovered: boolean; displacement: number }) => void)
    | undefined = undefined
</script>

{#each CHAMBER_SURFACES as surface (surface.id)}
  <ChamberSurface {surface} {onDebugChange} />
{/each}
