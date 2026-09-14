# Expressions, materials and physics

## Expressions

- MMD Tools creates `mmd_sdef_c`, `mmd_sdef_r0`, and `mmd_sdef_r1` shape keys as SDEF skinning storage. They are not authored expressions. Compare the imported inventory with PMX morph records, preserve the original import, and exclude the complete known helper set from the export mesh before binding expressions. Refuse unknown extras or authored names colliding with these reserved names instead of deleting them by prefix. Standard VRM linear blend skinning approximates the original SDEF deformation.
- Standard vowel mapping commonly uses `aa/ih/ou/ee/oh`, but source shape names and their actual effects must be inspected. Japanese `あ/い/う/え/お` is an observed convention, not a universal schema.
- Blink and wink names can have surprising meanings. Inspect the source group recipe and rendered eyelids; verify left/right rather than inferring from names alone.
- Clear existing preset binds before adding new ones. Exporter-generated binds plus duplicate manual binds can double the effective morph weight.
- Preserve source shape names as custom expressions. Some shapes deliberately alter hair, proportions or the whole model; do not omit them merely because they are not facial controls.
- A group expression may reference several shapes, nested groups or negative factors. Bake its evaluated vertex deltas when direct VRM binds cannot express it. Detect cycles and missing references. Preserve the original recipe in the source/audit data.
- VRM expressions do not directly encode arbitrary bone animation. Eye bone morphs can be baked into vertex differences from a controlled neutral pose, with original modifiers/rest transforms accounted for. This is only an approximation when combined with live eye tracking.
- Material/UV morphs need individual handling. VRM material-color or texture-transform binds cover some effects; legacy specular, shininess, sphere/toon factors and arbitrary per-vertex UV displacement are not interchangeable. List skipped channels and any range clamping. A control referencing a material unused by the avatar may have no runtime effect; report this explicitly.
- A PMX may reuse the same name for vertex and bone morphs. Keep source type/index as identity, assign unique export names, and preserve the reverse mapping. When baking a bone morph, use the installed MMD Tools coordinate conversion and evaluated mesh, assert unchanged vertex count, and restore the pose. The resulting rest-pose vertex delta is not a skeletal-animation control.
- For diffuse material morphs, evaluate the source multiply/add operation against the neutral material. Materials whose alpha changes need an alpha-capable render mode. Verify exported material-color binds separately from geometry morph activity; retain unsupported channels, clamps and empty separator controls in the report rather than claiming every control moves vertices.

## Physics and skinning

Weighted auxiliary arm bones can be siblings of a mapped upper arm and follow it through MMD IK. Removing IK leaves their weighted geometry behind even when the humanoid hierarchy is valid. Audit the constraint and rest segment; when the follower shares the arm's rest pivot and direction, reparenting it beneath the mapped arm can preserve weights and runtime following. Verify exported hierarchy, nonzero follower weights, relative transforms across poses, and visible sleeve/arm behavior. This is a scoped approximation, not a rule to reparent every auxiliary bone or preserve all IK/twist behavior.

Map bone-bound dynamic PMX bodies to skeleton-following spring chains. Keep every unique represented dynamic bone accounted for, while reporting unbound bodies and any multiple-body-to-one-bone collapse. Add terminal tips where needed and choose a stable center. Body colliders must be sized for the actual imported model.

MMD's coupled Bullet rigid bodies, joint constraints and cloth self collision do not translate exactly into VRM SpringBone. A static file export or finite simulation does not demonstrate perfect garment collision across all poses. Keep original physics in the source/working archive, record the chosen spring approximation, and inspect representative movement.

The bundled converter uses the four largest joint influences per vertex and renormalizes for common runtime compatibility. The .blend retains the fuller weight sets. If a target runtime supports more influences, validate that path deliberately: setting `export_all_influences` alone may be ignored when the add-on's advanced-preferences flag is disabled, and many viewers do not consume additional joint sets.

Alpha and shading are separate: an additive sphere map does not itself require BLEND on an otherwise opaque material. Use MToon matcap as an explicit approximation, preserve existing PBR maps where available, and inspect eye/hair transparency and depth ordering in the target viewer.

A nonzero sphere mode with texture index -1 has no active map. Record the inactive flag and continue; reject unsupported modes only when an actual sphere texture is referenced. An audited multiply-sphere mean-color approximation can retain a broad tint, but loses view-dependent lighting and must not become a silent universal fallback.

PBR texture operations must survive export. In a local replay, a green-channel inversion implemented through arbitrary shader nodes was ignored by glTF export: the embedded normal image remained byte-for-byte unchanged. Bake required channel conversions into a separate derived image, use exporter-supported image/Normal Map wiring, then compare the decoded embedded pixels against the intended transform. Keep the original texture unchanged and distinguish DirectX/OpenGL convention assumptions from measured channel preservation. Explicit alpha-threshold nodes exported MASK correctly; simply selecting Blender's DITHERED mode exported BLEND.
