"""Audit PMX or Blender avatars in background Blender without modifying inputs."""
import argparse, hashlib, json, sys, traceback
from pathlib import Path
import bpy

def register_addons(root):
    root=Path(root).resolve();sys.path[:0]=[str(root),str(root/'dependencies')]
    import mmd_tools,vrm
    mmd_tools.register();vrm.register()
    for name in ['mmd_tools','vrm']:
        if name not in bpy.context.preferences.addons:bpy.context.preferences.addons.new().module=name

def rna_props(value):
    out={}
    for prop in value.bl_rna.properties:
        key=prop.identifier
        if key=='rna_type':continue
        v=getattr(value,key)
        if prop.type=='COLLECTION':out[key]=[rna_props(x) for x in v]
        elif prop.type=='POINTER':out[key]=getattr(v,'name',None)
        elif getattr(prop,'is_array',False):out[key]=list(v)
        else:out[key]=v
    return out

def inspect(args):
    source=Path(args.input).resolve();output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
    report={'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'blender':bpy.app.version_string}
    try:
        register_addons(args.addons_root)
        if source.suffix.lower()=='.pmx':
            from mmd_tools.core import pmx
            pm=pmx.load(str(source))
            report['pmx']={'name':pm.name,'comment':pm.comment,'vertices':len(pm.vertices),'triangles':len(pm.faces),'materials':[vars(m) for m in pm.materials],'bones':[vars(b) for b in pm.bones],'morphs':[{'name':m.name,'type':type(m).__name__,'offset_count':len(m.offsets),'offsets':[vars(o) for o in m.offsets] if type(m).__name__!='VertexMorph' else None} for m in pm.morphs],'textures':[t.path for t in pm.textures]}
            active={m.texture for m in pm.materials if m.texture>=0}|{m.sphere_texture for m in pm.materials if m.sphere_texture>=0 and m.sphere_texture_mode}
            report['missing_textures']=[{'path':t.path,'active':i in active} for i,t in enumerate(pm.textures) if not Path(t.path).is_file()]
            assert not any(t['active'] for t in report['missing_textures']),'Active textures missing; inspect audit.json'
            bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
            bpy.ops.mmd_tools.import_model(filepath=str(source),scale=args.scale,clean_model=False,remove_doubles=False,rename_bones=False,fix_bone_order=False,log_level='WARNING')
        elif source.suffix.lower()=='.blend':bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False)
        else:raise ValueError('Supported audit inputs: .pmx and .blend')
        report['objects']=[{'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'visible':o.visible_get(),'hidden':o.hide_get(),'dimensions':list(o.dimensions),'modifiers':[{'name':m.name,'type':m.type} for m in o.modifiers]} for o in bpy.data.objects]
        report['armatures']=[{'name':o.name,'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'deform':b.use_deform,'mmd':rna_props(o.pose.bones[b.name].mmd_bone),'constraints':[{'name':c.name,'type':c.type} for c in o.pose.bones[b.name].constraints]} for b in o.data.bones]} for o in bpy.data.objects if o.type=='ARMATURE']
        report['meshes']=[]
        for o in bpy.data.objects:
            if o.type!='MESH' or not o.find_armature():continue
            weights={g.name:0.0 for g in o.vertex_groups}
            for v in o.data.vertices:
                for g in v.groups:weights[o.vertex_groups[g.group].name]+=g.weight
            report['meshes'].append({'name':o.name,'armature':o.find_armature().name,'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'materials':[m.name if m else None for m in o.data.materials],'shape_keys':list(o.data.shape_keys.key_blocks.keys()) if o.data.shape_keys else [],'weight_totals':weights})
        report['images']=[{'name':im.name,'path':im.filepath,'packed':bool(im.packed_file or im.packed_files),'size':list(im.size)} for im in bpy.data.images]
        report['materials']=[{'name':m.name,'mmd':rna_props(m.mmd_material),'nodes':[{'name':n.name,'type':n.type,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None,'group':n.node_tree.name if n.type=='GROUP' and n.node_tree else None} for n in m.node_tree.nodes] if m.use_nodes else [],'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links] if m.use_nodes else []} for m in bpy.data.materials]
        report['mmd_roots']=[{'name':o.name,'properties':rna_props(o.mmd_root)} for o in bpy.data.objects if o.mmd_type=='ROOT']
        report['rigids']=[{'name':o.name,'properties':rna_props(o.mmd_rigid)} for o in bpy.data.objects if o.mmd_type=='RIGID_BODY']
        report['texts']=[{'name':t.name,'text':t.as_string()} for t in bpy.data.texts]
        if args.save_import:
            target=output/'source.blend';assert target.resolve()!=source,'Refusing to overwrite the input'
            bpy.ops.wm.save_as_mainfile(filepath=str(target))
        report['status']='ok'
    except Exception:report['status']='failed';report['error']=traceback.format_exc()
    (output/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    if report['status']!='ok':raise RuntimeError(report['error'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--addons-root',required=True)
    p.add_argument('--scale',type=float,default=.08);p.add_argument('--save-import',action='store_true')
    inspect(p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []))
