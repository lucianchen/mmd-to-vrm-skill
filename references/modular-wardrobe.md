# Modular Unity wardrobe exports

This is scoped evidence from one same-rig Unity avatar wardrobe, not a universal VRChat converter.

Apply authored static active/blendShape curves individually. Sampling an entire AnimationClip can reset transforms outside the intended clothing state. Reload the source scene for each export, retain authored neutral morphs, and enforce user exclusions after applying the recipe so a clip cannot restore an excluded object.

Carry Unity GlobalObjectId identity into a node sidecar. Before extracting modular parts, compare source object mappings, hierarchy and rest transforms across every export; bind parts to the resident avatar using stable IDs. Do not infer compatibility from matching bone names alone.

Prune unused material, texture, image and buffer payloads by reachability, including MToon texture references. Verify retained mesh/morph/material/image semantics, bone palettes and inverse-bind matrices against the original full export. Keep the full exports as local authoring backups, not the app's per-item delivery format.

Build an explicit geometry ownership map across categories. A hat can also hide a hair tuft or toggle ears, so independent Unity menus need not own disjoint geometry. Record these overlaps and author a reversible occlusion/compatibility recipe; do not silently discard one category's edits. Intentionally empty accessory states must be explicit. Deduplicate byte-identical menu choices while retaining their source aliases in the export inventory.

Verify exports, runtime loading, visual appearance, combinations, physics, and target devices separately. Single-category loading and stable skeleton/expression identity do not prove all combinations or transferred PhysBone behavior. Record every source option, explicit exclusion, failed export and unresolved adapter requirement in the local inventory.