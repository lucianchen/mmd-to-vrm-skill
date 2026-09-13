# Local MMD / VRM comparison viewer

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
