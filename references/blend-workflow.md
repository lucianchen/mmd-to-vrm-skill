# Adapting an existing Blender avatar

Use `inspect_model.py --input source.blend ...` first. The helper inspects the scene without executing source scripts. Check all skinned meshes, effective material assignments, packed images, shape keys, rig weights, source texts and MMD properties. Large object counts often include rigid bodies and helper meshes; do not export them as character geometry.

## Preserve the artist's work

An MMD-derived .blend may contain remodeled clothing, updated UVs, replacement weights, baked normal maps or PBR materials absent from the original PMX. Use that scene as the conversion source. A missing image datablock is not necessarily a missing active texture: trace effective material links before declaring the model broken or dropping the material.

Keep Principled BSDF base color, normal, metallic and roughness links when glTF can represent them. Inspect nontrivial channel packing or custom shader graphs; bake/adapt only the unsupported portion. For MMDShaderDev materials or direct texture→surface setups, construct an explicit MToon/unlit equivalent as appropriate. Check alpha independently of sphere/matcap effects.

## Rig adaptation

MMD bone names can be Japanese prefixes (`左腕`) or Blender suffixes (`腕.L`). Consult parents, rest transforms and actual weight totals. Both ordinary and D leg groups can carry weights after an artist's reweighting. If consolidating equivalent chains, preserve normalized per-vertex weight totals, reparent the toe chain correctly, and render actual leg movement afterward.

Removing MMD constraints does not reproduce their semantics. Partial additional rotation, twist helpers and inverse shoulder/waist compensation need case-specific decisions. Some runtime helpers can follow an intended parent; others need weight changes or runtime constraints. Record approximations and keep the original .blend for recovery.

## Export isolation

Work in a copy/independent Blender process. Unparent avatar objects while preserving world transforms. Create a clean active scene containing the character rig and meshes; remove source physics display objects only from the conversion scene. Disable stale source animation/drivers only after recording what is being replaced.

After saving the working .blend, inspect `context.selected_objects`; object-level selected flags do not prove that the export operator will receive the mesh. Exporting an explicit clean object set avoids source context filtering. Inspect actual GLB mesh/material/triangle counts before proceeding to optimization.

The bundled PMX converter is not a generic .blend rewrite tool. Adapt a local script using these decisions. The optimizer also expects one source skinned mesh: support multi-mesh exports explicitly or retain the valid unoptimized file rather than forcing a destructive join.
