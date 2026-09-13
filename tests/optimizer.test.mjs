import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {optimizeVrm} from '../scripts/optimize_vrm.mjs';

// Synthetic geometry only; no character assets or extracted source data.
function fixture(change=()=>{}) {
  const chunks=[],bufferViews=[],accessors=[];let offset=0;
  const view=data=>{const index=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});chunks.push(data);offset+=data.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return index;};
  const floats=(values,type)=>{const data=Buffer.alloc(values.length*4);values.forEach((v,i)=>data.writeFloatLE(v,i*4));const index=accessors.length;accessors.push({bufferView:view(data),componentType:5126,count:values.length/({VEC3:3,VEC4:4}[type]||1),type});return index;};
  const pos=floats([0,0,0,1,0,0,0,1,0],'VEC3');
  const indices=accessors.length;accessors.push({bufferView:view(Buffer.from([0,0,1,0,2,0])),componentType:5123,count:3,type:'SCALAR'});
  const moving=floats([0,0,0,0,0.5,0,-0,0,0],'VEC3');
  const empty=floats([0,0,0,-0,0,0,0,0,0],'VEC3');
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const doc={asset:{version:'2.0'},buffers:[{byteLength:0}],bufferViews,accessors,images:[{bufferView:view(image),mimeType:'image/png'}],materials:[{name:'Face'},{name:'Body'}],nodes:[{mesh:0,skin:0,weights:[0.3]},{name:'Root'}],skins:[{joints:[1]}],scenes:[{nodes:[0,1]}],scene:0,
    meshes:[{name:'Synthetic',weights:[0],extras:{targetNames:['smile']},primitives:[{attributes:{POSITION:pos},indices,material:0,targets:[{POSITION:moving}]},{attributes:{POSITION:pos},indices,material:1,targets:[{POSITION:empty}]}]}],
    extensionsUsed:['VRMC_vrm'],extensions:{VRMC_vrm:{specVersion:'1.0',expressions:{preset:{happy:{morphTargetBinds:[{node:0,index:0,weight:0.5}]}},custom:{mmd_smile:{morphTargetBinds:[{node:0,index:0,weight:1}]}}},firstPerson:{meshAnnotations:[{node:0,type:'both'}]}}}};
  doc.buffers[0].byteLength=offset;change(doc);
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const bin=Buffer.concat(chunks),head=Buffer.alloc(20),bh=Buffer.alloc(8);
  head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
  return {raw:Buffer.concat([head,json,bh,bin]),image};
}
function read(raw){const len=raw.readUInt32LE(12);return {doc:JSON.parse(raw.toString('utf8',20,20+len)),bin:raw.subarray(28+len)};}

test('splits material parts while preserving images, values, expressions, weights and first-person annotations',()=>{
  const {raw,image}=fixture(),{output,report}=optimizeVrm(raw),{doc,bin}=read(output);
  assert.equal(doc.meshes.length,2);assert.equal(doc.nodes[0].mesh,undefined);
  assert.deepEqual(doc.nodes[2].weights,[0.3]);assert.equal(doc.nodes[3].weights,undefined);
  assert.equal(doc.meshes[1].primitives[0].targets,undefined);
  assert.deepEqual(doc.extensions.VRMC_vrm.expressions.preset.happy.morphTargetBinds,[{node:2,index:0,weight:0.5}]);
  assert.deepEqual(doc.extensions.VRMC_vrm.expressions.custom.mmd_smile.morphTargetBinds,[{node:2,index:0,weight:1}]);
  assert.deepEqual(doc.extensions.VRMC_vrm.firstPerson.meshAnnotations,[{node:2,type:'both'},{node:3,type:'both'}]);
  const iv=doc.bufferViews[doc.images[0].bufferView];assert.deepEqual(bin.subarray(iv.byteOffset,iv.byteOffset+iv.byteLength),image);
  const morph=doc.accessors[doc.meshes[0].primitives[0].targets[0].POSITION];assert.equal(morph.sparse.count,1);
  assert.equal(report.sparseMorphAccessors,1);assert.equal(report.zeroMorphAccessors,1);assert.equal(report.signedZeroNormalized,1);
  assert.ok(report.allRetainedAccessorValuesNumericallyIdentical&&report.allImageDataByteIdentical);
  assert.equal(report.outputSha256,crypto.createHash('sha256').update(output).digest('hex'));
  assert.equal(report.inputSha256,crypto.createHash('sha256').update(raw).digest('hex'));
  assert.deepEqual(report.sourceMorphNamesPreserved,['smile']);
});
test('rejects skeleton-only and already split files',()=>{
  assert.throws(()=>optimizeVrm(fixture(d=>d.meshes=[]).raw),/no geometry/);
  assert.throws(()=>optimizeVrm(fixture(d=>d.meshes.push(structuredClone(d.meshes[0]))).raw),/single-mesh/);
});
test('rejects morph animations and extensions with unknown accessor references',()=>{
  assert.throws(()=>optimizeVrm(fixture(d=>d.animations=[{channels:[{target:{node:0,path:'weights'}}],samplers:[]}]).raw));
  assert.throws(()=>optimizeVrm(fixture(d=>d.extensionsUsed.push('EXT_future_accessor')).raw),/unsupported extensions/);
  assert.throws(()=>optimizeVrm(fixture(d=>d.extensionsUsed.push('EXT_meshopt_compression')).raw),/Compressed geometry/);
});
test('rejects external images, missing morph names, and malformed containers',()=>{
  assert.throws(()=>optimizeVrm(fixture(d=>d.images=[{uri:'outside.png'}]).raw),/embedded/);
  assert.throws(()=>optimizeVrm(fixture(d=>delete d.meshes[0].extras.targetNames).raw),/names\/count/);
  const {raw}=fixture();assert.throws(()=>optimizeVrm(raw.subarray(0,24)),/Truncated/);
  const corrupt=Buffer.from(raw);corrupt.writeUInt32LE(3,4);assert.throws(()=>optimizeVrm(corrupt));
});
