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

An outfit can contain all required human bones while having no head geometry or expression morphs. Compare the actual source geometry with package preview images and label it as a component. The bundled verifier's thirteen-expression default remains strict. A local capability-specific adaptation may omit expression checks only with an explicit audited reason recorded in the report; do not add empty fake expressions or call that a fully functional avatar. Validate material-only expressions through their material bindings and visible effect, separately from geometry movement.

## Experience underlying this skill

The workflow was developed across four local character conversions, including Japanese-prefix rigs, Blender-suffix rigs, mixed ordinary/D-leg weights, a PBR clothing redesign, and PMX group expressions. The parameterized PMX conversion and browser helpers were exercised on a real model with 162 vertex morphs plus 14 group morphs, eight materials and 54,313 triangles. Source model files, textures and per-model machine paths are intentionally excluded. The owner-requested README comparison renders have separate attribution and rendering notes under `assets/comparison/`.

Synthetic optimizer tests cover primitive/binding remapping, node weights, signed zero, image payload preservation and rejection of unsupported inputs. They supplement the real local run; they do not prove universal compatibility.

The dependency-free Python morph-inventory tests run with `python -m unittest discover -s tests -p 'test_*.py'`. They check SDEF helper exclusion, ordinary imports, reserved-name collisions, unknown extras, and incomplete storage sets. Run these alongside `npm test` when changing the PMX shape inventory handling.

A subsequent batch added six complete PMX exports, three multi-mesh FBX exports and one headless PMX outfit component. All retained source triangle counts and passed runtime checks within their documented capability scope. Front/back and available neutral/blink/mouth screenshots were inspected. Local adapters covered duplicate bone/vertex morph names, diffuse material-color expressions, inactive sphere flags, nonstandard humanoid hierarchy, FBX world transforms/emission and explicit PBR normal-channel baking. Those adapters are not advertised as generic published converters; the reusable procedures and limits are recorded in [lessons.json](lessons.json).
