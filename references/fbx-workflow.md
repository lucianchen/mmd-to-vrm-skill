# Rigged FBX and accompanying game materials

This is an audited adaptation path, not a new input mode for `convert_pmx.py`. Three local FBX packages were converted with separate adapters; the published helper remains strict about its supported PMX structure.

## World coordinates and scene scope

Import into an isolated factory-startup process or clear all relevant scene data deliberately. A batch audit using global `bpy.data.objects` can accidentally include objects retained in other scenes. Inventory the imported scene/rig and its bound meshes. Preserve each mesh's shape keys, material slots and triangle count.

Call `view_layer.update()` before reading world matrices. Local FBX bones were Y-up in the tested packages, while the importer had already rotated the armature object to Blender's Z-up world. A second X rotation produced a sideways avatar that still passed finite-number and deformation checks. Inspect world-space head, hips and feet, preserve world matrices while removing parents, and apply intentional object transforms consistently to armature and meshes. Confirm the actual final rendered orientation before accepting the file.

## Material reconstruction

Inspect nearby material metadata instead of guessing from filenames. In the tested Unity exports, `m_SavedProperties.m_TexEnvs` mapped `_MainTex` to a texture's `m_Texture.Name`. Resolve that name unambiguously and account for remaining texture channels. Copying only the FBX's imported Principled defaults inherited white emission on several materials; explicitly reset unwanted emission when rebuilding diffuse MToon materials, then inspect the exported material and actual render.

Game-specific lightmaps, packed masks, eye maps, projected hair shadows and detail layers are not generic glTF shader inputs. Keep a per-material inventory of represented and unrepresented channels. A shader-only shadow-pass mesh may need a documented zero-opacity placeholder; do not silently delete its geometry. Original source metadata and meshes remain available for a later engine-specific reconstruction.

For PBR packages, use explicit base-color, normal and ORM channel metadata where available. Do not assume arbitrary Blender shader calculations will be baked by glTF; see [material export verification](expressions-physics.md).

## Expressions, physics and validation

A single named face shape may occur on several meshes, such as face and eyebrows. Bind every relevant occurrence and retain all source custom shapes. Preserve multiple meshes when the optimizer's one-source-mesh contract does not apply. A byte-identical copy of an already valid export is an honest final artifact; record that optimization was skipped.

These three FBX imports did not supply usable spring/rigid-body configuration. Humanoid deformation and face shapes were verified; hair/clothing secondary physics was not invented. Missing physics needs a deliberate later setup, not an implied successful transfer.

Use the final avatar's actual bounds for full-body QA framing and reframe after a pose changes them. The earlier fixed-height camera cropped a tall avatar with a weapon. Geometry bounds, shader compilation and 600 finite simulation steps cannot replace front/back and neutral/blink/mouth inspection.
