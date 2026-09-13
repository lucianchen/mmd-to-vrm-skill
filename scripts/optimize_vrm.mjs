import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
function parse(buf){
 assert.ok(buf.length>=28,'Truncated GLB');assert.equal(buf.toString('utf8',0,4),'glTF');assert.equal(buf.readUInt32LE(4),2);assert.equal(buf.readUInt32LE(8),buf.length);
 const len=buf.readUInt32LE(12);assert.equal(buf.readUInt32LE(16),0x4e4f534a);assert.ok(28+len<=buf.length);assert.equal(buf.readUInt32LE(24+len),0x004e4942);assert.equal(buf.readUInt32LE(20+len),buf.length-28-len);
 return {doc:JSON.parse(buf.toString('utf8',20,20+len)),bin:buf.subarray(28+len)};
}
export function optimizeVrm(raw){
const original=parse(raw),doc=structuredClone(original.doc);
assert.ok(doc.meshes?.length,'GLB contains no geometry');
assert.equal(doc.buffers.length,1);assert.ok(!doc.buffers[0].uri,'Embedded single-buffer GLB required');
assert.ok(!(doc.extensionsUsed||[]).some(e=>['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(e)),'Compressed geometry is outside this optimizer scope');
assert.ok((doc.images||[]).every(im=>im.bufferView!==undefined&&!im.uri),'Images must be embedded');
assert.ok(doc.extensions?.VRMC_vrm?.expressions,'VRM 1.0 expressions required');
const supportedExtensions=new Set(['VRMC_vrm','VRMC_springBone','VRMC_node_constraint','VRMC_materials_mtoon','VRMC_materials_hdr_emissiveMultiplier','KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength','KHR_materials_specular','KHR_materials_ior','KHR_materials_clearcoat','KHR_materials_sheen','KHR_materials_transmission','KHR_materials_volume','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_dispersion','KHR_lights_punctual','EXT_texture_webp','KHR_texture_basisu']);
assert.ok((doc.extensionsUsed||[]).every(e=>supportedExtensions.has(e)),'Review unsupported extensions before pruning their possible accessor references');
const counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const widths={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
function decode(j,bin,index){
 const a=j.accessors[index],width=counts[a.type]*widths[a.componentType],out=Buffer.alloc(a.count*width);
 if(a.bufferView!==undefined){const v=j.bufferViews[a.bufferView],stride=v.byteStride||width,start=(v.byteOffset||0)+(a.byteOffset||0);for(let i=0;i<a.count;i++)bin.copy(out,i*width,start+i*stride,start+i*stride+width);}
 if(a.sparse){const s=a.sparse,iv=j.bufferViews[s.indices.bufferView],vv=j.bufferViews[s.values.bufferView],iw=widths[s.indices.componentType];for(let i=0;i<s.count;i++){const off=(iv.byteOffset||0)+(s.indices.byteOffset||0)+i*iw;const idx=iw===1?bin.readUInt8(off):iw===2?bin.readUInt16LE(off):bin.readUInt32LE(off);const val=(vv.byteOffset||0)+(s.values.byteOffset||0)+i*width;bin.copy(out,idx*width,val,val+width);}}
 return out;
}
const views=doc.bufferViews.map(v=>original.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));
const addView=b=>{const i=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteLength:b.length});views.push(b);return i;};
const morphAccessors=new Set(doc.meshes.flatMap(m=>m.primitives.flatMap(p=>(p.targets||[]).flatMap(t=>Object.values(t)))));
let sparse=0,zero=0;
for(const index of morphAccessors){
 const a=doc.accessors[index],dense=decode(original.doc,original.bin,index),width=counts[a.type]*widths[a.componentType],indices=[];
 assert.equal(a.componentType,5126);
 for(let i=0;i<a.count;i++){let nz=false;for(let k=0;k<width;k+=4)if(dense.readFloatLE(i*width+k)!==0){nz=true;break;}if(nz)indices.push(i);}
 if(!indices.length){delete a.bufferView;delete a.byteOffset;delete a.sparse;zero++;continue;}
 const iw=a.count<=256?1:a.count<=65536?2:4;
 if(indices.length*(width+iw)>=dense.length)continue;
 const ib=Buffer.alloc(indices.length*iw),vb=Buffer.alloc(indices.length*width);
 indices.forEach((idx,i)=>{if(iw===1)ib.writeUInt8(idx,i);else if(iw===2)ib.writeUInt16LE(idx,i*iw);else ib.writeUInt32LE(idx,i*iw);dense.copy(vb,i*width,idx*width,(idx+1)*width);});
 a.sparse={count:indices.length,indices:{bufferView:addView(ib),componentType:iw===1?5121:iw===2?5123:5125},values:{bufferView:addView(vb)}};
 delete a.bufferView;delete a.byteOffset;sparse++;
}
// Split material primitives so body/hair do not allocate empty facial morph
// layers on the GPU. Keep every nonzero deformation and rebind every expression.
assert.equal(doc.meshes.length,1,'Use the original single-mesh export as input, not a split/optimized file');
assert.ok(!(doc.animations||[]).some(a=>a.channels.some(c=>c.target.path==='weights')));
const sourceMesh=doc.meshes[0],meshNodes=doc.nodes.map((n,i)=>({n,i})).filter(x=>x.n.mesh===0);
const targetNames=sourceMesh.extras?.targetNames||[];
assert.ok(sourceMesh.primitives.every(p=>(p.targets||[]).length===targetNames.length),'Morph target names/count mismatch');
assert.equal(meshNodes.length,1);
const parent=meshNodes[0],skin=parent.n.skin,nodeWeights=parent.n.weights,parts=[],partNodeIndices=[];
assert.notEqual(skin,undefined,'One skinned source mesh is required');
delete parent.n.mesh;delete parent.n.skin;delete parent.n.weights;
for(const [pidx,p] of sourceMesh.primitives.entries()){
 const active=(p.targets||[]).map((t,i)=>({t,i})).filter(({t})=>Object.values(t).some(idx=>doc.accessors[idx].bufferView!==undefined||doc.accessors[idx].sparse));
 const primitive={...p};if(active.length)primitive.targets=active.map(x=>x.t);else delete primitive.targets;
 const name=doc.materials[p.material]?.name||`part_${pidx}`;
 const mesh={name,primitives:[primitive]};
 if(active.length){mesh.extras={...(sourceMesh.extras||{}),targetNames:active.map(x=>(sourceMesh.extras?.targetNames||[])[x.i])};if(sourceMesh.weights)mesh.weights=active.map(x=>sourceMesh.weights[x.i]);}
 const nodeIndex=doc.nodes.length;doc.nodes.push({name:(sourceMesh.name||'Avatar')+'_'+name,mesh:pidx,skin,...(nodeWeights&&active.length?{weights:active.map(x=>nodeWeights[x.i])}:{})});partNodeIndices.push(nodeIndex);
 parts.push({mesh,nodeIndex,morphMap:new Map(active.map((x,i)=>[x.i,i]))});
}
parent.n.children=[...(parent.n.children||[]),...partNodeIndices];doc.meshes=parts.map(p=>p.mesh);
let expressionBindsRemapped=0;
for(const exp of [...Object.values(doc.extensions.VRMC_vrm.expressions.preset),...Object.values(doc.extensions.VRMC_vrm.expressions.custom)]){
 const old=exp.morphTargetBinds||[];
 exp.morphTargetBinds=old.flatMap(bind=>{
  if(bind.node!==parent.i)return [bind];
  const out=parts.filter(p=>p.morphMap.has(bind.index)).map(p=>({...bind,node:p.nodeIndex,index:p.morphMap.get(bind.index)}));expressionBindsRemapped+=out.length;return out;
 });
}
const annotations=doc.extensions.VRMC_vrm.firstPerson?.meshAnnotations;
if(annotations)doc.extensions.VRMC_vrm.firstPerson.meshAnnotations=annotations.flatMap(a=>a.node===parent.i?partNodeIndices.map(node=>({...a,node})):[a]);
const accessorRefs=[];
for(const m of doc.meshes)for(const p of m.primitives){for(const k of Object.keys(p.attributes))accessorRefs.push([p.attributes,k]);if(p.indices!==undefined)accessorRefs.push([p,'indices']);for(const t of p.targets||[])for(const k of Object.keys(t))accessorRefs.push([t,k]);}
for(const s of doc.skins||[])if(s.inverseBindMatrices!==undefined)accessorRefs.push([s,'inverseBindMatrices']);
for(const a of doc.animations||[])for(const s of a.samplers)accessorRefs.push([s,'input'],[s,'output']);
const keptAccessors=[...new Set(accessorRefs.map(([o,k])=>o[k]))];
const accessorMap=new Map(keptAccessors.map((old,i)=>[old,i]));
for(const [o,k] of accessorRefs)o[k]=accessorMap.get(o[k]);
const removedAccessorCount=doc.accessors.length-keptAccessors.length;
doc.accessors=keptAccessors.map(i=>doc.accessors[i]);
const refs=[];
function walk(o){if(!o||typeof o!=='object')return;for(const [k,v] of Object.entries(o)){if(k==='bufferView'&&typeof v==='number')refs.push([o,k,v]);else walk(v);}}
walk(doc);const used=[...new Set(refs.map(r=>r[2]))],remap=new Map(),chunks=[];let offset=0;
const newViews=used.map((old,i)=>{remap.set(old,i);const data=views[old],v={...doc.bufferViews[old],buffer:0,byteOffset:offset,byteLength:data.length};chunks.push(data);offset+=data.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return v;});
for(const [o,k,old] of refs)o[k]=remap.get(old);
doc.bufferViews=newViews;doc.buffers=[{byteLength:offset}];const binary=Buffer.concat(chunks);
let signedZeroNormalized=0;
for(let i=0;i<doc.accessors.length;i++){
 const a=decode(doc,binary,i),b=decode(original.doc,original.bin,keptAccessors[i]);
 if(a.equals(b))continue;
 assert.equal(doc.accessors[i].componentType,5126);
 for(let k=0;k<a.length;k+=4){assert.ok(a.readFloatLE(k)===b.readFloatLE(k),`Accessor ${i} value ${k/4} changed`);if(a.readUInt32LE(k)!==b.readUInt32LE(k))signedZeroNormalized++;}
}
for(let i=0;i<(doc.images||[]).length;i++){const a=doc.bufferViews[doc.images[i].bufferView],b=original.doc.bufferViews[original.doc.images[i].bufferView];assert.ok(binary.subarray(a.byteOffset,a.byteOffset+a.byteLength).equals(original.bin.subarray(b.byteOffset||0,(b.byteOffset||0)+b.byteLength)),`Image ${i} changed`);}
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,json,bh,binary]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={originalBytes:raw.length,optimizedBytes:output.length,inputSha256:sha(raw),outputSha256:sha(output),accessorsVerified:doc.accessors.length,imagesVerified:(doc.images||[]).length,sparseMorphAccessors:sparse,zeroMorphAccessors:zero,allRetainedAccessorValuesNumericallyIdentical:true,signedZeroNormalized,allImageDataByteIdentical:true,removedUnreferencedOrZeroMorphAccessors:removedAccessorCount,materialParts:parts.length,expressionBindsRemapped,sourceMorphNamesPreserved:targetNames};
return {output,report};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},report:{type:'string'}}});
 assert.ok(values.input&&values.output,'Usage: node optimize_vrm.mjs --input original.vrm --output final.vrm [--report report.json]');
 const inputPath=path.resolve(values.input),outputPath=path.resolve(values.output);
 assert.notEqual(inputPath,outputPath,'Preserve the original export; output must be a separate file');
 const reportPath=path.resolve(values.report||path.join(path.dirname(outputPath),'optimization-report.json'));
 assert.ok(reportPath!==inputPath&&reportPath!==outputPath,'Report path must be separate');
 const {output,report}=optimizeVrm(fs.readFileSync(inputPath));
 fs.mkdirSync(path.dirname(outputPath),{recursive:true});
 fs.writeFileSync(outputPath,output);fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,sourceMorphNamesPreserved:report.sourceMorphNamesPreserved.length},null,2));
}
