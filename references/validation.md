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

World-space bone displacement can come entirely from the animated humanoid parent. When verifying newly configured secondary motion, also sample the runtime spring joints' local rotations while driving the head/body, assert finite state, and confirm the intended joints actually change. A local UnityPackage replay checked 66 moving spring joints over 600 frames; that establishes activity and numeric stability, not equivalence to Unity PhysBones. For rebased default morphs, separately activate and clear every custom control and compare the restored sampled geometry with the baseline; effective-control counts must exclude zero-delta placeholders.

An outfit can contain all required human bones while having no head geometry or expression morphs. Compare the actual source geometry with package preview images and label it as a component. The bundled verifier's thirteen-expression default remains strict. A local capability-specific adaptation may omit expression checks only with an explicit audited reason recorded in the report; do not add empty fake expressions or call that a fully functional avatar. Validate material-only expressions through their material bindings and visible effect, separately from geometry movement.

## Investigating a triangle-count mismatch

Keep the default exact triangle check. A local export had one fewer triangle than its PMX because two source faces used the same vertices in opposite winding within an already double-sided material. Before accepting that particular difference, compare counts per material, source face identities, double-sided flags and the affected material's exported triangle-position multiset against the source, with an explicit numeric tolerance. Only one duplicate surface instance was absent; all other material counts and unique surface positions remained. Record the source/export totals, face IDs, final file hash and proof in a separate scoped audit. A small count difference alone is not evidence of harmless cleanup, and this geometric comparison does not prove shading equivalence or justify omitting a distinct surface.

## Comparing an existing avatar with a conversion

Keep each baseline file immutable and distinguish a library asset from application-specific enhanced variants. Compare hashes, embedded preset bindings and rendered effects; extra named morph targets do not guarantee that standard VRM presets actually bind them. A local pair of existing assets contained empty left/right blink presets, including the variant with added wink targets. Preserve that diagnostic failure. Application-level remapping is a separate capability and must not be inferred from standalone file behavior.

Sparse vertex samples can miss a localized expression. A zero sampled displacement is not proof that a bound shape is empty: inspect the referenced morph accessors and rendered vertices, or verify the actual face image. Also distinguish an empty bind list, all-zero target geometry and a present but visually subtle expression.

For a VRM 0/VRM 1 comparison adapter, normalize the forward direction and verify the pose basis as well as the camera. Rotating the VRM 0 scene alone left the same arm rotation raising its arms while the VRM 1 arms lowered; the local adapter corrected the VRM 0 rotation signs and visually rechecked standing poses. Do not use a mis-posed or cropped baseline to judge the model. The bundled conversion verifier targets VRM 1 and does not advertise this comparison adapter as a generic mode.

Use identical lighting, exposure and resolution, with height-normalized body and head-relative face framing. Report download size separately from model triangles, materials and actual render calls. In a local comparison, an 11.08 MB conversion had 30,922 model triangles but 56 scene draw calls and 59,265 rendered triangles including outlines; an 80.36 MB baseline had 59,413 model triangles and 5 draw calls. This demonstrates why file size and raw triangle count alone cannot establish runtime performance. These are scene counters, not a hardware benchmark.

## Experience underlying this skill

The workflow was developed across four local character conversions, including Japanese-prefix rigs, Blender-suffix rigs, mixed ordinary/D-leg weights, a PBR clothing redesign, and PMX group expressions. The parameterized PMX conversion and browser helpers were exercised on a real model with 162 vertex morphs plus 14 group morphs, eight materials and 54,313 triangles. Source model files, textures and per-model machine paths are intentionally excluded. The owner-requested README comparison renders have separate attribution and rendering notes under `assets/comparison/`.

Synthetic optimizer tests cover primitive/binding remapping, node weights, signed zero, image payload preservation and rejection of unsupported inputs. They supplement the real local run; they do not prove universal compatibility.

The dependency-free Python morph-inventory tests run with `python -m unittest discover -s tests -p 'test_*.py'`. They check SDEF helper exclusion, ordinary imports, reserved-name collisions, unknown extras, and incomplete storage sets. Run these alongside `npm test` when changing the PMX shape inventory handling.

A subsequent batch added six complete PMX exports, three multi-mesh FBX exports and one headless PMX outfit component. All retained source triangle counts and passed runtime checks within their documented capability scope. Front/back and available neutral/blink/mouth screenshots were inspected. Local adapters covered duplicate bone/vertex morph names, diffuse material-color expressions, inactive sphere flags, nonstandard humanoid hierarchy, FBX world transforms/emission and explicit PBR normal-channel baking. Those adapters are not advertised as generic published converters; the reusable procedures and limits are recorded in [lessons.json](lessons.json).
