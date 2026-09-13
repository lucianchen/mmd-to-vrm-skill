import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {validateRuntime} from './runtime_checks.mjs';

const {values}=parseArgs({options:Object.fromEntries(['input','conversion','optimization','runtime','source','output'].map(k=>[k,{type:'string'}]))});
for(const key of ['input','conversion','optimization','runtime','source','output'])assert.ok(values[key],`Missing --${key}`);
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const c=read(values.conversion),opt=read(values.optimization),rt=read(values.runtime);
const raw=fs.readFileSync(values.input),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(raw.toString('utf8',0,4),'glTF');assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
const j=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
assert.equal(c.status,'ok');assert.equal(rt.status,'completed');assert.deepEqual(rt.errors,[]);
assert.equal(opt.outputSha256,sha(raw),'Optimization report belongs to another artifact');
assert.equal(rt.inputSha256,sha(raw),'Runtime report belongs to another artifact');
assert.equal(c.source_sha256,sha(fs.readFileSync(values.source)),'Source changed since conversion');
assert.ok(opt.allRetainedAccessorValuesNumericallyIdentical&&opt.allImageDataByteIdentical);
const vrm=j.extensions.VRMC_vrm;assert.equal(vrm.specVersion,'1.0');
const required=['hips','spine','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];
for(const name of required)assert.ok(Number.isInteger(vrm.humanoid.humanBones[name]?.node)&&j.nodes[vrm.humanoid.humanBones[name].node],`Required human bone missing: ${name}`);
assert.ok(j.meshes?.length&&j.materials?.length,'Avatar geometry missing');
const triangles=j.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+j.accessors[p.indices].count/3,0),0);
assert.equal(triangles,c.source_triangles,'Triangle count changed');
assert.ok(Array.isArray(c.custom_morph_names),'Conversion report must list expected custom morph names');
const emptyMorphs=[];
for(const name of c.custom_morph_names){
  const exp=vrm.expressions.custom['mmd_'+name];assert.ok(exp,`Missing custom expression: ${name}`);
  if(!exp.morphTargetBinds?.length)emptyMorphs.push(name);
}
for(const exp of [...Object.values(vrm.expressions.preset),...Object.values(vrm.expressions.custom)])for(const b of exp.morphTargetBinds||[]){
  const mesh=j.meshes[j.nodes[b.node]?.mesh];assert.ok(mesh&&mesh.primitives.every(p=>p.targets?.[b.index]),'Invalid morph bind after optimization');
}
validateRuntime(rt);
for(const image of j.images||[])assert.ok(Number.isInteger(image.bufferView)&&j.bufferViews[image.bufferView],'Image is not embedded');
const report={status:'passed',file:path.basename(values.input),bytes:raw.length,sha256:sha(raw),vrmVersion:'1.0',triangles,materials:j.materials.length,embeddedImages:j.images?.length||0,humanBones:Object.keys(vrm.humanoid.humanBones).length,customMorphs:c.custom_morph_names.length,emptyMorphs,springChains:j.extensions.VRMC_springBone?.springs?.length||0,dynamicJoints:rt.info.springJoints||0,physicsFrames:600,sourceUnchanged:true,numericOptimizationVerified:true,textureBytePreservationVerified:true,runtimeVerified:true,visualInspection:'Requires separate human/agent screenshot inspection',limitations:c.warnings||[]};
const target=path.resolve(values.output);
assert.ok(!['input','source','conversion','optimization','runtime'].some(k=>path.resolve(values[k])===target),'Output must be a separate report');
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
