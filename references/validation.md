# What counts as verified

## Layers of evidence

1. **Source audit:** explicit model choice; image usage; bone weights/hierarchy; morph types; author/license data; unchanged source hash.
2. **Export structure:** real meshes, expected triangles/materials, valid human bone nodes and embedded images. A 100 KB skeleton-only VRM can still load without throwing: exporter success is insufficient.
3. **Optimization invariants:** retained accessor values are numerically identical, with signed zero canonicalized; embedded image bytes are identical; effective morph, first-person and expression bindings are remapped after primitive splitting. This compares the two VRM files, not Blender rendering/physics semantics.
4. **Runtime:** the final file loads through GLTFLoader + VRMLoaderPlugin. Check active expression weights, finite geometry, deformed vertex samples, front/back views and 600 simulation steps. The bundled verifier requires the thirteen configured standard expressions; missing expressions should be documented/adapted, not silently marked passed.
5. **Visual inspection:** inspect screenshots for clipping, reversed winks, teeth/eyelid artifacts, missing textures, exploding meshes, bad hands/feet and garment behavior. Numeric pass flags alone do not establish appearance quality.
6. **Target deployment:** application integration, headset/iOS/Android behavior and hardware performance require separate tests. Software Chromium screenshots and simulation timings are not mobile FPS benchmarks.

## Tool scope

The optimizer accepts an uncompressed GLB with one skinned source mesh, embedded images and VRM 1.0 expressions. It splits material primitives and prunes zero/unreferenced morph storage. It rejects morph-weight animation channels, unsupported extensions and multi-mesh inputs before writing a final file. Feed the original export, not an already split output. Keep the large original as a recovery/comparison file until the final output is accepted.

Browser verification aliases one Three.js instance to avoid mixed constructors. It serves only the chosen model and generated JS on loopback with an ephemeral port, and closes the browser/server in `finally`. Shader compilation/render errors or non-finite bounds fail the run. Inspect additional-expression snapshots for their intended visual effect; the helper cannot infer what a custom expression is meant to do.

## Experience underlying this skill

The workflow was developed across four local character conversions, including Japanese-prefix rigs, Blender-suffix rigs, mixed ordinary/D-leg weights, a PBR clothing redesign, and PMX group expressions. The parameterized PMX conversion and browser helpers were exercised on a real model with 162 vertex morphs plus 14 group morphs, eight materials and 54,313 triangles. Copyrighted model files, textures, screenshots and per-model machine paths are intentionally not included in this repository.

Synthetic optimizer tests cover primitive/binding remapping, node weights, signed zero, image payload preservation and rejection of unsupported inputs. They supplement the real local run; they do not prove universal compatibility.
