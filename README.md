# Cube block showcase
This project is a standalone Vite + Svelte + Threlte study of a single modular environment block. The root route (`/`) renders one hero block in a neutral studio scene so the asset can be validated in isolation before it is repeated across walls, floors, and ceilings.
## Run it
- `yarn install`
- `yarn dev`
- `yarn run check`
- `yarn build`
## What was confirmed from Houdini
- The source asset lives in `/obj/vault_block_asset`.
- The block is centered at the origin and occupies exact unit bounds from `-0.5` to `0.5` on all axes.
- The Houdini network is a box SOP passed through a polybevel, normals, per-face UV projection/transform nodes, curvature masking, triangulation, and tangent generation.
- The inspected final asset is a very light real-time mesh: 108 triangles, with a small rounded edge band rather than a heavily subdivided cube.
## What was optimized for the web
- `src/lib/block/blockAsset.ts` recreates the block as a shared rounded cube geometry instead of shipping a heavier direct export path.
- The geometry uses a unit-sized rounded profile tuned to the Houdini bevel width and is merged into an indexed buffer so it stays cheap enough for later instancing.
- The dark brushed-metal finish is generated from small procedural roughness and bump textures, avoiding external texture payloads while preserving subtle streaking and roughness variation.
- Lighting uses a PMREM room environment, a small directional-light rig, and a shadow catcher instead of expensive post-processing.
## Motion and glow behavior
- `src/lib/components/Block.svelte` now owns the hover interaction, spring extraction, and glow response while keeping the block origin stable for reuse in a repeated chamber grid.
- The extraction motion is a lightweight per-block spring solved inside Threlte's frame loop. The cube moves along its local `inwardFaceDirection`, and the normalized displacement (`currentDistance / extractionDistance`) is reused directly as the glow driver.
- Glow is generated with a single additional additive mesh built from only the allowed side faces. The face mask is derived from the dominant local axis of `inwardFaceDirection`, so the inward-facing face and its opposite axis are excluded from emission.
- The glow itself is a soft border alpha mask on those side panels rather than fullscreen bloom or dynamic lights. That keeps the effect sharp, cheap, and easy to scale to many cubes later.
## Structure for future instancing
- `src/lib/components/Block.svelte` is the reusable motion-aware block component with a stable origin-centered pivot.
- `src/lib/block/blockAsset.ts` exports the shared base geometry, glow mask texture, and cached side-face glow geometry so a future repeated scene can move toward `THREE.InstancedMesh` or Threlte instancing without rebuilding per-block resources.
- Keep blocks at unit scale and place them on a clean grid to assemble larger surfaces.
## Parameters to tune later
- `extractionDistance`
- `springStiffness`
- `springDamping`
- `maxGlowIntensity`
- `glowColor`
- `inwardFaceDirection`
## Tradeoffs
- Houdini MCP export and parameter-inspection helpers were partially broken, so the final web asset mirrors the confirmed proportions, symmetry, and bevel intent rather than ingesting a direct exported mesh.
- The web material aims for the same premium dark metal response as the reference while staying deterministic and lightweight enough for mass reuse.
- The first-pass glow system uses one extra overlay mesh per block rather than a custom WebGPU shader extension. That keeps it renderer-compatible today and still maps cleanly to a future instanced version by moving displacement and glow strength into per-instance attributes.
