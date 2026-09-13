# MMD / VRM comparison viewer

Use the [hosted viewer](https://lucianchen.github.io/mmd-to-vrm-skill/) or run locally. Both versions read selected model files on your device, with no upload endpoint.

## Language

The header's 中文 / EN buttons switch controls, status messages, errors, statistics, accessibility labels and PNG captions without recreating renderers, loading models again or resetting cameras. The choice is saved in browser local storage when available. URL `?lang=en` or `?lang=zh` takes priority, then the saved choice, then the browser's primary language. Chinese locales use Chinese; other locales fall back to English. File names and low-level library diagnostics retain their original text.

## Local usage

Run `npm run compare` after installing the pinned Node dependencies. Open `http://127.0.0.1:8766`. The static page and its bundled dependencies are served locally; no model upload endpoint exists.

Optional CLI arguments:

```sh
npm run compare -- --port 8767 --mmd /assets/avatar/model.pmx --vrm /work/avatar/Avatar.vrm
```

Use a complete MMD folder in the left file picker, including its relative texture folders. The PMX selector appears when multiple variants are found. The right picker accepts a VRM with embedded textures. Chinese names, Windows backslashes, encoded spaces and unambiguous case differences are supported. Missing or ambiguous textures produce an error instead of guessing by basename. Embedded VRM textures use loader-generated same-origin blob URLs; preserve those when restricting resource lookup.

Both panes share the same camera by default. Drag to orbit, wheel to zoom, and right-drag to pan. Uncheck synchronization to inspect one side independently. The three camera buttons reset full-body, face and back framing. Brightness affects both renderers; automatic rotation and PNG export use the current view.

## Rendering conditions and limits

- Both sides use Three.js 0.169.0 with the same lights, environment, ACES tone mapping and exposure. MMD uses MMDLoader / OutlineEffect; VRM uses three-vrm 3.4.4 and the model's MToon/PBR materials. Different shaders are intentionally retained.
- Source PMX geometry is normalized to the same 1.65-unit height as the VRM. Common Japanese MMD arm names or Blender `.L` / `.R` aliases are aligned toward T pose in the preview only. Unknown arm naming keeps the original pose and reports that state; helper bones and wrists can still differ. Original files are never written.
- Physics is paused. This webpage is not native MMD + MME and does not reproduce all MMD effects, constraints, SDEF behavior or non-vertex morph types. Use the conversion audit and dedicated expression/physics verifier for acceptance.
- The face preset is framed for typical humanoid proportions; orbit/zoom manually for unusual heads, accessories or body scales. Large models still depend on the browser's GPU capabilities.
- The built-in image exporter preserves the view and adds MMD/VRM labels. Model attribution belongs in the accompanying README or caption; the renderer cannot infer publication permissions.
- The optional example server only binds to `127.0.0.1`, confines assets to the selected PMX folder, and rejects traversal/symlink escapes. It remains a local development tool, not a hosted service.

Readme comparison renders should name the source model, creators and renderer, disclose normalization/pose/shader limitations, and include only explicitly requested screenshots. Do not publish the selected source files or embedded textures.

## Static hosting

Run `npm ci --ignore-scripts` and `npm run build:compare`. Publish only `dist/`. The builder copies a fixed list of browser files, bundles pinned dependencies with license notices and writes `{ "mmd": null, "vrm": null }` as the hosted manifest. It refuses unknown files already present in the output directory, so accidental model assets cannot silently enter a later deployment. Review unexpected files instead of deleting them blindly. The local server's optional examples and their paths are never copied.

HTML assets and the manifest use module-relative URLs, including under `/mmd-to-vrm-skill/`. No CDN, analytics, remote fonts, backend, model examples or model upload API are required. A hosted page downloads its own code; selected PMX/VRM/texture files are resolved to local blob URLs. Browser folder selection is required to grant texture access; choose the complete folder on a desktop browser that supports directory inputs.

The repository's `.github/workflows/pages.yml` runs on `main` pushes or manual dispatch. Repository Settings → Pages → Source must be **GitHub Actions**. The public-only build uses the standard `ubuntu-latest` runner, runs `npm test`, builds and uploads `dist/`; deployment uses the `github-pages` environment with `pages: write` and `id-token: write`. GitHub Pages and standard Actions runners are free for public repositories under the [Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) rules. No paid plan, custom domain or third-party hosting is needed.

Verify deployment with the real project URL, an empty startup manifest, both language choices and browser-selected models. A successful local build alone does not prove the published site works. Keep screenshots, local model paths and network/console QA reports outside the repository.
