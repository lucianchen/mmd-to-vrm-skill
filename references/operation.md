# Runtime and model profiles

Tested locally on Windows with Blender 5.2.1 LTS, MMD Tools 4.5.14, VRM Add-on 4.7.1, Node 24, and the dependency versions pinned in package.json. These are tested versions, not claims about the latest releases or every platform.

Upstream installation/version guidance: [MMD Tools](https://github.com/MMD-Blender/blender_mmd_tools), [VRM Add-on](https://github.com/saturday06/VRM-Addon-for-Blender), [three-vrm](https://github.com/pixiv/three-vrm).

## Isolated add-ons

The Python helpers accept an explicit `--addons-root` or `addons_root` profile path containing importable `mmd_tools/` and `vrm/` modules. Optional imported dependencies can be placed in `dependencies/` under that directory. Obtain compatible packages from upstream; add-ons and their dependencies are not vendored here. A differently named Blender extension installation may require adapting registration imports.

Run Python helpers with Blender's Python, not ordinary Python. A background launch should include `--factory-startup --disable-autoexec --python-exit-code 1 --python SCRIPT -- SCRIPT_ARGS`. The arguments after `--` belong to the helper. Never execute embedded source Text blocks or enable source file auto-run to make conversion convenient.

Windows: resolve the actual Blender executable/Store launcher. A Store launcher's process ID or exit can precede completion of its Blender child; use the generated JSON report and file timestamps to establish completion. Use hidden background processes and proper argument arrays/quoting for paths with spaces or Chinese characters. Standard Python outside Blender is sufficient only for syntax/skill metadata validation.

## PMX profile

All profile paths resolve relative to the JSON file, or can be absolute. Keep real profiles outside the skill repository (or under ignored `private/`). Configuration fields:

| Field | Meaning |
|---|---|
| `input`, `output`, `output_stem`, `addons_root` | Source PMX, isolated output directory, plain filename stem, importable add-on directory |
| `scale` | Import scale; 0.08 was suitable for the tested PMX assets, but verify resulting height |
| `humanoid_mapping` | VRM Add-on snake_case field → exact Blender bone name |
| `helper_reparenting` | Exact child → parent changes justified by rig audit |
| `weight_transfers` | Optional old vertex group → runtime bone group; review rest transforms before merging |
| `expressions` | Preset field → `{source_shape_name: weight}`; includes generated group shapes |
| `license_file`, `license_encoding`, `meta` | Source license text and explicitly sourced VRM metadata |
| `material_overrides` | Per-material `alpha_mode`, `alpha_cutoff`, `outline_width`, or `matcap_factor` |
| `physics` | Existing center bone, spring parameters and body sphere colliders |

`meta` requires `authors` (array) and `vrm_name`; other keys are VRM Add-on meta property names such as `version`, `copyright_information`, `avatar_permission`, `commercial_usage`, `allow_redistribution`, `modification`, and `credit_notation`. Derive them from the actual source terms; retain fuller restrictions in the embedded license text.

Each collider is `{ "bone": "BoneName", "offset": [0,0,0.08], "radius": 0.06 }`. Offset is added to the bone head in Blender armature space, then transformed into that bone's local space. These values are model-dependent, in the imported scale.

Use the audited actual names for `hips`, `spine`, `chest`, optional `upper_chest`, `neck`, `head`, eyes, both limb chains and fingers. A model with only two upper-body segments should not invent a third. Required mappings are also checked by the exporter and final structural audit.

The PMX converter deliberately refuses duplicate morph names, multiple avatar meshes/rigs, unsupported morph types and unsupported sphere modes instead of silently dropping data. Use a local adapted conversion script for those cases and document the resulting limitations.

## Broken texture paths in source packages

Distinguish a missing image from a broken reference before adapting an incomplete package. Inspect the PMX texture table, actual package paths and atlas content. Similar filenames alone do not establish a match. For a supported recovery, copy the source package to an isolated staging directory, remap only the confirmed references, preserve image bytes, and inspect the final face, hair and accessory UV appearance. Keep original and derived PMX hashes plus the explicit mapping; do not rename the user's source files in place.

If an active image is truly absent, keep the normal converter's error. A local adaptation may retain the affected geometry and original diffuse RGBA without that texture when this is a useful partial conversion within the request. Record the material indices, missing paths, triangle count and unrecovered pattern/texture alpha, and disclose the fallback in the gallery and delivery. This is not a successful texture recovery. Do not substitute an unrelated atlas or silently drop faces to pass validation.

Audit source text encoding separately from filename corruption. A UTF-16 credit sheet can remain readable even when its filename is garbled; decode from its BOM and preserve the full text. When a derived PMX is used, final validation should check that derived input and also rehash every original package file. Optimization texture-byte checks cover the exported VRM optimization step, not the entire source-to-VRM conversion.

## Commands

```sh
blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/inspect_model.py -- --input /assets/model.pmx --output /work/avatar-audit --addons-root /tools/addons
blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/convert_pmx.py -- --profile /work/avatar-profile.json
node scripts/optimize_vrm.mjs --input /work/avatar/Avatar-export-original.vrm --output /work/avatar/Avatar.vrm
node scripts/verify_vrm.mjs --input /work/avatar/Avatar.vrm --output /work/avatar/qa
node scripts/audit_vrm.mjs --input /work/avatar/Avatar.vrm --conversion /work/avatar/conversion-report.json --optimization /work/avatar/optimization-report.json --runtime /work/avatar/qa/runtime-report.json --source /assets/model.pmx --output /work/avatar/FINAL-VALIDATION.json
```

`verify_vrm.mjs --dependencies /path/to/another/package-root` can reuse an existing compatible Node installation; the default is this skill's package.json directory. `--expressions extra.json` accepts an array of additional expression names, saves their snapshots and screenshots, and checks that requested names exist. It does not automatically judge the intended visual meaning of a custom expression.
