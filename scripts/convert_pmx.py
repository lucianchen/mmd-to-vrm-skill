"""Convert an audited PMX using an explicit per-model JSON profile (Blender)."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import traceback
import uuid

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_model import register_addons


def convert(profile_path):
    profile_path = Path(profile_path).resolve()
    config = json.loads(profile_path.read_text(encoding='utf-8-sig'))
    resolve = lambda value: (profile_path.parent / value).resolve()
    source = resolve(config['input'])
    output = resolve(config['output'])
    output.mkdir(parents=True, exist_ok=True)
    stem = config['output_stem']
    assert stem and Path(stem).name == stem and '/' not in stem and '\\' not in stem
    report = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'warnings': []}

    def checkpoint(stage):
        report['stage'] = stage
        (output / 'conversion-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding='utf-8')

    sys.stdout = open(output / 'convert.stdout.log', 'w', encoding='utf-8', buffering=1)
    sys.stderr = open(output / 'convert.stderr.log', 'w', encoding='utf-8', buffering=1)
    try:
        assert source.suffix.lower() == '.pmx', 'For .blend inputs use the Blender workflow reference'
        register_addons(resolve(config['addons_root']))
        from mmd_tools.core import pmx
        pm = pmx.load(str(source))
        report['source_morphs'] = [{'name':m.name, 'type':type(m).__name__} for m in pm.morphs]
        report['source_triangles'] = len(pm.faces)
        assert len({m.name for m in pm.morphs}) == len(pm.morphs), 'Duplicate PMX morph names require explicit disambiguation'
        unsupported = [m.name for m in pm.morphs if type(m).__name__ not in ['VertexMorph', 'GroupMorph']]
        assert not unsupported, f'Adapt bone/material/UV morphs explicitly before using this helper: {unsupported}'
        active = {m.texture for m in pm.materials if m.texture >= 0} | {m.sphere_texture for m in pm.materials if m.sphere_texture >= 0 and m.sphere_texture_mode}
        report['missing_textures'] = [{'path': t.path, 'active': i in active} for i,t in enumerate(pm.textures) if not Path(t.path).is_file()]
        assert not any(t['active'] for t in report['missing_textures']), 'Missing active textures'
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.ops.mmd_tools.import_model(filepath=str(source), scale=config.get('scale', .08), clean_model=False, remove_doubles=False, rename_bones=False, fix_bone_order=False, log_level='WARNING')
        armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
        assert len(armatures) == 1, 'Choose one avatar rig explicitly'
        arm = armatures[0]
        meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == arm]
        assert len(meshes) == 1, 'This helper supports one source mesh; adapt multi-mesh avatars separately'
        mesh = meshes[0]
        bpy.ops.wm.save_as_mainfile(filepath=str(output / 'source.blend'))
        report['removed_helpers'] = [o.name for o in bpy.data.objects if o not in [arm,mesh]]
        for obj in [arm,mesh]:
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
            obj.animation_data_clear()
        for obj in list(bpy.data.objects):
            if obj not in [arm,mesh]: bpy.data.objects.remove(obj, do_unlink=True)
        scene = bpy.data.scenes.new(stem + ' VRM Export')
        for obj in [arm,mesh]:
            scene.collection.objects.link(obj)
            obj.hide_select = obj.hide_viewport = obj.hide_render = False
        bpy.context.window.scene = scene
        for obj in [arm,mesh]: obj.hide_set(False)
        mesh.parent = arm
        arm.name = stem
        mesh.name = stem + 'Mesh'
        report['removed_constraints'] = [{'bone':b.name, 'types':[c.type for c in b.constraints]} for b in arm.pose.bones if b.constraints]
        for b in arm.pose.bones:
            for c in list(b.constraints): b.constraints.remove(c)
            b.matrix_basis = Matrix.Identity(4)
        keys = mesh.data.shape_keys.key_blocks
        mesh.data.shape_keys.animation_data_clear()
        for key in keys: key.value = 0
        report['source_weight_totals'] = {g.name: 0.0 for g in mesh.vertex_groups}
        for v in mesh.data.vertices:
            for g in v.groups: report['source_weight_totals'][mesh.vertex_groups[g.group].name] += g.weight
        report['weight_transfers'] = config.get('weight_transfers', {})
        if report['weight_transfers']:
            for v in mesh.data.vertices:
                total = sum(g.weight for g in v.groups)
                if total > 0:
                    for g in list(v.groups): mesh.vertex_groups[g.group].add([v.index], g.weight / total, 'REPLACE')
            before = [sum(g.weight for g in v.groups) for v in mesh.data.vertices]
            for old,new in report['weight_transfers'].items():
                assert old in mesh.vertex_groups and new in arm.data.bones, (old,new)
                og = mesh.vertex_groups[old]
                ng = mesh.vertex_groups.get(new) or mesh.vertex_groups.new(name=new)
                values = [(v.index,sum(g.weight for g in v.groups if g.group in [og.index,ng.index])) for v in mesh.data.vertices if any(g.group == og.index for g in v.groups)]
                for index,weight in values:
                    assert weight <= 1.00001
                    ng.add([index], min(weight,1), 'REPLACE')
                mesh.vertex_groups.remove(og)
            report['weight_transfer_max_error'] = max(abs(a-sum(g.weight for g in v.groups)) for a,v in zip(before,mesh.data.vertices))
            assert report['weight_transfer_max_error'] < 1e-5
        ext = arm.data.vrm_addon_extension
        ext.spec_version = '1.0'
        mapping = config['humanoid_mapping']
        assert len(set(mapping.values())) == len(mapping), 'Human bones must map to distinct source bones'
        for key,name in mapping.items():
            assert name in arm.data.bones, name
            getattr(ext.vrm1.humanoid.human_bones,key).node.bone_name = name
        report['humanoid_mapping'] = mapping
        bpy.context.view_layer.objects.active = arm
        arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for child,parent in config.get('helper_reparenting', {}).items():
            assert child in arm.data.edit_bones and parent in arm.data.edit_bones
            arm.data.edit_bones[child].use_connect = False
            arm.data.edit_bones[child].parent = arm.data.edit_bones[parent]
        bpy.ops.object.mode_set(mode='OBJECT')
        report['helper_reparenting'] = config.get('helper_reparenting', {})
        from vrm.editor.vrm1.property_group import Vrm1HumanBonesPropertyGroup
        Vrm1HumanBonesPropertyGroup.update_all_bone_name_candidates(bpy.context, arm.data.name, force=True)
        hierarchy_errors = list(ext.vrm1.humanoid.human_bones.error_messages())
        assert not hierarchy_errors, 'Invalid humanoid hierarchy: ' + '; '.join(hierarchy_errors)
        checkpoint('expressions')
        basis = np.empty(len(mesh.data.vertices)*3, dtype=np.float32)
        keys[0].data.foreach_get('co',basis)
        cached = {}
        def morph_delta(index, stack=()):
            assert index not in stack, 'Cyclic group morph'
            if index in cached: return cached[index]
            m = pm.morphs[index]
            if type(m).__name__ == 'VertexMorph':
                value = np.empty_like(basis)
                keys[m.name].data.foreach_get('co',value)
                delta = value-basis
            else:
                delta = np.zeros_like(basis)
                for off in m.offsets:
                    assert 0 <= off.morph < len(pm.morphs)
                    delta += morph_delta(off.morph, (*stack,index))*off.factor
            cached[index] = delta
            return delta
        report['baked_group_morphs'] = []
        for i,m in enumerate(pm.morphs):
            if type(m).__name__ == 'GroupMorph':
                key = mesh.shape_key_add(name=m.name, from_mix=False)
                key.data.foreach_set('co',basis+morph_delta(i))
                report['baked_group_morphs'].append(m.name)
        def bind(exp, values):
            for name,weight in values.items():
                assert name in keys and 0 <= weight <= 1, (name,weight)
                b = exp.morph_target_binds.add()
                b.node.mesh_object_name = mesh.name
                b.index = name
                b.weight = weight
        for preset,values in config['expressions'].items():
            exp = getattr(ext.vrm1.expressions.preset,preset)
            exp.morph_target_binds.clear()
            bind(exp,values)
        ext.vrm1.expressions.custom.clear()
        for key in list(keys)[1:]:
            exp = ext.vrm1.expressions.custom.add()
            exp.custom_name = 'mmd_' + key.name
            bind(exp,{key.name:1})
        report['custom_morph_names'] = list(keys.keys())[1:]
        report['expressions'] = config['expressions']
        look = ext.vrm1.look_at
        look.type = 'bone'
        look.offset_from_head_bone = (0,-.02,.06)
        for name,value in [('range_map_horizontal_inner',8),('range_map_horizontal_outer',12),('range_map_vertical_up',8),('range_map_vertical_down',8)]:
            rm = getattr(look,name); rm.input_max_value = 90; rm.output_scale = value
        meta = ext.vrm1.meta
        meta_config = config['meta']
        assert meta_config['authors'] and meta_config['vrm_name']
        meta.authors.clear()
        for author in meta_config['authors']: meta.authors.add().value = author
        for name,value in meta_config.items():
            if name != 'authors': setattr(meta,name,value)
        meta.third_party_licenses = resolve(config['license_file']).read_text(encoding=config.get('license_encoding','utf-8-sig'))
        (output/'SOURCE-LICENSE.txt').write_text(meta.third_party_licenses,encoding='utf-8')
        checkpoint('materials')
        report['materials'] = []
        for i,src in enumerate(pm.materials):
            mat = mesh.data.materials[i]
            assert mat.name == src.name, 'Resolve duplicate/renamed material slots explicitly'
            img = bpy.data.images.load(pm.textures[src.texture].path,check_existing=True) if src.texture >= 0 else None
            alpha = False
            if img and img.channels == 4:
                px = np.empty(len(img.pixels),dtype=np.float32); img.pixels.foreach_get(px)
                alpha = bool(np.any(px[3::4] < .99))
            mat.vrm_addon_extension.mtoon1.enabled = True
            gltf = mat.vrm_addon_extension.mtoon1
            gltf.pbr_metallic_roughness.base_color_factor = tuple(src.diffuse)
            gltf.pbr_metallic_roughness.base_color_texture.index.source = img
            gltf.double_sided = src.is_double_sided
            overrides = config.get('material_overrides',{}).get(src.name,{})
            gltf.alpha_mode = overrides.get('alpha_mode', 'BLEND' if src.diffuse[3] < .99 else ('MASK' if alpha else 'OPAQUE'))
            gltf.alpha_cutoff = overrides.get('alpha_cutoff', .35)
            mt = gltf.extensions.vrmc_materials_mtoon
            mt.shade_multiply_texture.index.source = img
            mt.shade_color_factor = (.82,.80,.83)
            mt.shading_shift_factor = -.08
            mt.shading_toony_factor = .9
            mt.gi_equalization_factor = .85
            mt.outline_width_mode = 'worldCoordinates' if src.enabled_toon_edge else 'none'
            mt.outline_width_factor = overrides.get('outline_width', .0005)
            mt.outline_color_factor = (.15,.10,.14)
            if src.sphere_texture_mode == 2 and src.sphere_texture >= 0:
                mt.matcap_texture.index.source = bpy.data.images.load(pm.textures[src.sphere_texture].path,check_existing=True)
                mt.matcap_factor = tuple(overrides.get('matcap_factor',[.35,.35,.35]))
                report['warnings'].append(src.name + ': additive sphere approximated as MToon matcap')
            elif src.sphere_texture_mode and src.sphere_texture >= 0:
                raise ValueError('Adapt unsupported sphere mode explicitly: ' + src.name)
            elif src.sphere_texture_mode:
                report.setdefault('inactive_sphere_flags', []).append({'material':src.name, 'mode':src.sphere_texture_mode, 'texture_index':src.sphere_texture})
            report['materials'].append({'name':src.name,'texture':img.name if img else None,'alpha':gltf.alpha_mode})
        checkpoint('physics')
        physics = config['physics']
        sb = ext.spring_bone1
        sb.springs.clear(); sb.colliders.clear(); sb.collider_groups.clear()
        dynamic = {pm.bones[r.bone].name for r in pm.rigids if r.mode != 0 and r.bone is not None and 0 <= r.bone < len(pm.bones)}
        report['unbound_dynamic_rigids'] = [r.name for r in pm.rigids if r.mode != 0 and (r.bone is None or not 0 <= r.bone < len(pm.bones))]
        children = {n:[c.name for c in arm.data.bones[n].children if c.name in dynamic] for n in dynamic}
        roots = sorted(n for n in dynamic if not arm.data.bones[n].parent or arm.data.bones[n].parent.name not in dynamic or len(children[arm.data.bones[n].parent.name]) != 1)
        chains = []
        for root in roots:
            chain = [root]
            while len(children[chain[-1]]) == 1: chain.append(children[chain[-1]][0])
            chains.append(chain)
        assert {n for c in chains for n in c} == dynamic
        bpy.ops.object.mode_set(mode='EDIT')
        for i,chain in enumerate(chains):
            last = arm.data.edit_bones[chain[-1]]
            if children[chain[-1]]: endpoint = children[chain[-1]][0]
            else:
                tip = arm.data.edit_bones.new(f'vrm_tip_{i:03d}')
                tip.head = last.tail
                if (tip.head-last.head).length < .0001: tip.head = last.head+Vector((0,0,-.01))
                tip.tail = tip.head+Vector((0,0,-.005)); tip.parent = last; tip.use_deform = False
                endpoint = tip.name
            chain.append(endpoint)
        bpy.ops.object.mode_set(mode='OBJECT')
        for chain in chains:
            spring = sb.springs.add(); spring.vrm_name = chain[0]
            spring.center.bone_name = physics['center']
            for name in chain:
                j = spring.joints.add(); j.node.bone_name = name
                j.stiffness = physics.get('stiffness',1.6); j.gravity_power = physics.get('gravity_power',.12)
                j.gravity_dir = (0,0,-1); j.drag_force = physics.get('drag_force',.65); j.hit_radius = physics.get('hit_radius',.004)
        if physics.get('colliders'):
            group = sb.collider_groups.add(); group.uuid = uuid.uuid4().hex; group.vrm_name = 'Body'
            for spec in physics['colliders']:
                bone = spec['bone']; assert bone in arm.pose.bones
                col = sb.colliders.add(); col.uuid = uuid.uuid4().hex; col.node.bone_name = bone; col.shape_type = 'Sphere'
                col.reset_bpy_object(bpy.context,arm)
                col.shape.sphere.offset = arm.pose.bones[bone].matrix.inverted() @ (arm.pose.bones[bone].head+Vector(spec['offset']))
                col.shape.sphere.radius = spec['radius']; group.colliders.add().collider_uuid = col.uuid
            for spring in sb.springs: spring.collider_groups.add().collider_group_uuid = group.uuid
        report['spring_chains'] = chains
        report['dynamic_bone_count'] = len(dynamic)
        report['warnings'].append('MMD rigid-body coupling, self collision and additional rotations are approximated; source.blend retains original data')
        checkpoint('export')
        bpy.context.view_layer.objects.active = arm
        report['tpose_result'] = list(bpy.ops.vrm.make_estimated_humanoid_t_pose(armature_object_name=arm.name))
        for im in bpy.data.images:
            if im.source == 'FILE' and im.size[0] > 0 and not im.packed_file: im.pack()
        bpy.ops.wm.save_as_mainfile(filepath=str(output/(stem+'-vrm.blend')))
        export_path = output/(stem+'-export-original.vrm')
        # Enumerate the clean scene after saving: selection can be empty after save.
        result = bpy.ops.export_scene.vrm(filepath=str(export_path),armature_object_name=arm.name,export_invisibles=True,export_only_selections=False,enable_advanced_preferences=True,export_all_influences=False,export_try_sparse_sk=True,ignore_warning=True)
        assert result == {'FINISHED'}
        raw = export_path.read_bytes(); size = struct.unpack_from('<I',raw,12)[0]
        doc = json.loads(raw[20:20+size])
        assert doc.get('meshes') and doc.get('materials'), 'Export contains no avatar geometry'
        report['warnings'].append('Export uses the four largest joint influences per vertex and renormalizes for common viewer compatibility')
        report['source_unchanged'] = hashlib.sha256(source.read_bytes()).hexdigest() == report['source_sha256']
        assert report['source_unchanged']
        report['status'] = 'ok'
    except Exception:
        report['status'] = 'failed'; report['error'] = traceback.format_exc()
    checkpoint(report.get('stage','initialization'))
    if report['status'] != 'ok': raise RuntimeError(report['error'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    convert(args.profile)
