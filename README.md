# MMD to VRM Skill

[中文说明](README.zh-CN.md) · [Skill instructions](SKILL.md) · [Verified lessons](references/lessons.json)

**[Open the comparison studio](https://lucianchen.github.io/mmd-to-vrm-skill/?lang=en)** · English / 中文 · Models stay on your device.

A Codex skill for converting rigged MMD avatars into **VRM 1.0**, with reproducible export, optimization, and browser validation. Every conversion starts with a model audit; bone names alone are not enough to choose a working rig.

The skill includes a parameterized PMX converter, guidance for preserving artist-modified Blender projects, a conservative VRM optimizer, a local comparison viewer, and an evidence-based maintenance workflow. Source models, textures and machine-specific profiles stay outside this repository; the comparison renders below were specifically requested for the README.

## MMD / VRM visual comparison

The actual source PMX is on the **left**; the delivered VRM is on the **right**. Both are rendered in the same browser with shared lighting and camera settings, height normalization, approximately aligned T poses, and physics paused. Shading differences are visible rather than corrected away.

**Full body**

![Lucy source MMD on the left and converted VRM on the right, full-body comparison](assets/comparison/lucy-full.png)

**Face and material detail**

![Lucy source MMD and converted VRM, close-up comparison of face, hair and material shading](assets/comparison/lucy-face.png)

Model: Lucy / 露西. Provided by **Wuthering Waves / 鸣潮**; modified by **homura59**. These are actual model renders. The MMD side uses Three.js MMD Toon, not native MMD + MME; the VRM side uses three-vrm MToon/PBR. [Render conditions and attribution](assets/comparison/README.md).

## Comparison webpage: online or local

Use the [free hosted viewer](https://lucianchen.github.io/mmd-to-vrm-skill/?lang=en) without installing anything, or run it locally after `npm ci --ignore-scripts`:

```sh
npm run compare
```

Open **http://127.0.0.1:8766**, choose the complete MMD folder (including textures), then choose an embedded-texture VRM file. If the folder contains multiple PMX files, select the intended version beneath the MMD viewport. Files remain on your computer.

The **中文 / EN** switch translates controls, loading states, errors, geometry statistics and exported image captions without reloading models or moving the camera. The viewer remembers the choice; `?lang=en` or `?lang=zh` overrides it. On first use, Chinese browser locales select Chinese; other locales default to English.

The page supports synchronized orbit, zoom and pan; independent cameras; full-body, face and back views; shared brightness; automatic rotation; and PNG comparison export. It stacks the viewports on narrow screens. Optional startup arguments can load a local example directly:

```sh
npm run compare -- --mmd /assets/avatar/model.pmx --vrm /work/avatar/Avatar.vrm
```

The server binds to loopback only and serves the selected model resources; it does not publish or upload model files. Use `--port 8767` if the default port is occupied, and Ctrl+C to stop. This is a static appearance viewer, not a conversion button or a native MMD physics emulator. [Viewer details](references/comparison-viewer.md).

## Install

Clone this public repository into the `mmd-to-vrm` folder under your Codex skills directory. For a standard Windows setup:

```powershell
git clone https://github.com/lucianchen/mmd-to-vrm-skill.git "$env:USERPROFILE/.codex/skills/mmd-to-vrm"
Set-Location "$env:USERPROFILE/.codex/skills/mmd-to-vrm"
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

If the destination already exists, inspect its Git status and remote before updating it. Preserve local changes. Keeping the Git checkout allows verified future improvements to be committed and synced to the repository.

Invoke `$mmd-to-vrm` in Codex and give it the source model path. Example:

> Use $mmd-to-vrm to convert this PMX to VRM, verify expressions and skinning, and update the skill with any newly verified lessons.

## Requirements and supported scope

| Component | Tested version |
| --- | --- |
| Blender | 5.2.1 LTS, Windows Store launcher |
| MMD Tools | 4.5.14 |
| VRM Add-on for Blender | 4.7.1 |
| Node.js | 24.12.0; package declares Node 22+ |
| three / three-vrm | 0.169.0 / 3.4.4 |
| Playwright / esbuild | 1.57.0 / 0.25.12 |

The tested configuration is Windows; other platforms have not been verified. Install compatible Blender add-ons separately. They are not bundled or installed globally by this skill. Python conversion scripts run inside Blender.

- **PMX:** the supplied converter supports one armature, one skinned mesh, vertex morphs and recursively composed group morphs. Other structures stop with an explicit error and need an audited local adaptation.
- **Blender projects:** inspect the actual saved project and follow the [preservation workflow](references/blend-workflow.md). The PMX helper is not a universal Blender material/rig converter.
- **Rigged FBX packages:** an [audited adaptation workflow](references/fbx-workflow.md) covers imported world transforms, material metadata, multiple meshes and missing secondary physics. Three local packages were verified with separate adapters; FBX is not an input mode of the supplied PMX converter.
- **Rig and expression mapping:** model-specific settings remain necessary. The skill examines actual weights, helper constraints, morph types and license text before preparing a profile.
- **Physics and shading:** MMD rigid-body behavior and some sphere materials are approximations in VRM. The editable source is retained. Export uses the four largest joint influences per vertex for viewer compatibility.

See [runtime setup, profile fields and complete commands](references/operation.md) and [expression/physics details](references/expressions-physics.md).

## Workflow and deliverables

1. Audit the PMX or Blender source and preserve its hash and license.
2. Prepare an external JSON profile from actual bone, weight, material and morph data.
3. Export a packed editable `.blend` and `Avatar-export-original.vrm`.
4. Optimize into a separate `Avatar.vrm`, checking retained accessor values and image bytes.
5. Load the final file in Chromium using three-vrm; exercise 13 standard expressions, arm and leg poses, and 600 physics frames. Inspect screenshots separately.
6. Produce a final audit that links the optimization and runtime results to the delivered file's SHA-256.

`Avatar.vrm` is the deliverable. The larger `Avatar-export-original.vrm` is the preoptimization comparison and rollback copy; it is not a second required runtime asset. It can be removed after acceptance if the editable project and final file are retained. Re-optimization must start from an original export, not an already split optimized file.

The optimizer only accepts the documented single-mesh, embedded-texture VRM structure. It preserves numerical accessor values and image bytes within that scope; this does **not** establish lossless equivalence between all MMD features and VRM. Browser checks also do not establish target-application or mobile-device performance. See [validation boundaries](references/validation.md).

## Self-improvement after each conversion

After completing a conversion, the agent compares its findings with [the lesson registry](references/lessons.json). New evidence can refine instructions, fix reusable scripts, add focused regression coverage, and record a scoped lesson. Repeated identical lessons produce no change; correcting a lesson requires explicit replacement.

```sh
node scripts/record_lesson.mjs --entry /work/verified-lesson.json
npm test
```

A lesson contains `id`, `status: "verified"`, `date`, `scope`, `observation`, `resolution`, `evidence`, `regression`, and `limitations`. The recorder checks structure and common private paths; the agent must still review the evidence and full diff. Passing schema checks does not prove a claim true.

The owner has requested ongoing maintenance of this public repository. After relevant validation, the agent reviews and commits only reusable changes, pushes to the verified origin, then compares local and remote commit hashes. This happens during conversion tasks; it does not run a background scheduler. No new evidence means no unnecessary commit. Full protocol: [iteration.md](references/iteration.md).

## Free hosting and deployment

The viewer is hosted on **GitHub Pages**. Pushes to `main` run the tests, build the static site and deploy it through [the Pages workflow](.github/workflows/pages.yml). It uses a standard `ubuntu-latest` runner and runs only for public repositories. GitHub provides [Pages for public repositories on GitHub Free](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [free standard hosted Actions runners for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

`npm run build:compare` creates `dist/` containing only HTML, CSS, bundled JavaScript with dependency notices, and an empty example manifest. There is no backend or upload endpoint. Models selected in the hosted page are read through the browser's File API; model binaries, textures, local example configuration and README renders are excluded from the deployed site. Other static hosts can serve the same directory. [Build and deployment details](references/comparison-viewer.md#static-hosting).

## Verification and repository contents

The initial parameterized PMX pipeline was exercised end to end on a local model with **54,313 triangles, 176 custom morphs, 53 human bones and 141 spring joints**. The optimized output was **15,629,324 bytes**, down from **35,655,224 bytes**; browser checks completed without reported JavaScript errors or nonfinite geometry. Source and generated model binaries are intentionally absent here.

Nineteen automated Node tests cover material splitting, sparse morphs and signed zero, expression/first-person remapping, node weights, unchanged image payloads, unsupported input rejection, transient physics failures, shader errors, lesson recording/revision, comparison-viewer asset paths, translation completeness and the static publication boundary. Model tests use generated geometry only. Real-model checks and manual screenshot review remain necessary for each conversion.

| Path | Purpose |
| --- | --- |
| `SKILL.md`, `agents/openai.yaml` | Codex entry point and discovery metadata |
| `scripts/inspect_model.py`, `scripts/convert_pmx.py` | Blender audit and profile-driven PMX conversion |
| `scripts/optimize_vrm.mjs` | Sparse morph optimization with value/image checks |
| `scripts/viewer.js`, `scripts/verify_vrm.mjs` | Local rendering, pose/expression/physics checks |
| `scripts/audit_vrm.mjs` | Hash-bound final structural/runtime audit |
| `scripts/record_lesson.mjs` | Verified lesson registration with duplicate protection |
| `compare/`, `scripts/serve_compare.mjs` | Local interactive MMD/VRM comparison webpage |
| `assets/comparison/` | Requested README renders and attribution |
| `references/`, `tests/` | Detailed guidance, lessons and synthetic regressions |

Model conversion and model redistribution are separate permissions. Read each source's terms and preserve attribution and restrictions. Keep source and generated model binaries and textures out of skill maintenance commits; publish comparison screenshots only when explicitly requested and with appropriate attribution.
