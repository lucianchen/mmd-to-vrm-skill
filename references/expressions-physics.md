# Expressions, materials and physics

## Expressions

- Standard vowel mapping commonly uses `aa/ih/ou/ee/oh`, but source shape names and their actual effects must be inspected. Japanese `あ/い/う/え/お` is an observed convention, not a universal schema.
- Blink and wink names can have surprising meanings. Inspect the source group recipe and rendered eyelids; verify left/right rather than inferring from names alone.
- Clear existing preset binds before adding new ones. Exporter-generated binds plus duplicate manual binds can double the effective morph weight.
- Preserve source shape names as custom expressions. Some shapes deliberately alter hair, proportions or the whole model; do not omit them merely because they are not facial controls.
- A group expression may reference several shapes, nested groups or negative factors. Bake its evaluated vertex deltas when direct VRM binds cannot express it. Detect cycles and missing references. Preserve the original recipe in the source/audit data.
- VRM expressions do not directly encode arbitrary bone animation. Eye bone morphs can be baked into vertex differences from a controlled neutral pose, with original modifiers/rest transforms accounted for. This is only an approximation when combined with live eye tracking.
- Material/UV morphs need individual handling. VRM material-color or texture-transform binds cover some effects; legacy specular, shininess, sphere/toon factors and arbitrary per-vertex UV displacement are not interchangeable. List skipped channels and any range clamping. A control referencing a material unused by the avatar may have no runtime effect; report this explicitly.

## Physics and skinning

Map bone-bound dynamic PMX bodies to skeleton-following spring chains. Keep every unique represented dynamic bone accounted for, while reporting unbound bodies and any multiple-body-to-one-bone collapse. Add terminal tips where needed and choose a stable center. Body colliders must be sized for the actual imported model.

MMD's coupled Bullet rigid bodies, joint constraints and cloth self collision do not translate exactly into VRM SpringBone. A static file export or finite simulation does not demonstrate perfect garment collision across all poses. Keep original physics in the source/working archive, record the chosen spring approximation, and inspect representative movement.

The bundled converter uses the four largest joint influences per vertex and renormalizes for common runtime compatibility. The .blend retains the fuller weight sets. If a target runtime supports more influences, validate that path deliberately: setting `export_all_influences` alone may be ignored when the add-on's advanced-preferences flag is disabled, and many viewers do not consume additional joint sets.

Alpha and shading are separate: an additive sphere map does not itself require BLEND on an otherwise opaque material. Use MToon matcap as an explicit approximation, preserve existing PBR maps where available, and inspect eye/hair transparency and depth ordering in the target viewer.
