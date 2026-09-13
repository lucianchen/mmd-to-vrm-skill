import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSimulationSnapshot,validateRuntime} from '../scripts/runtime_checks.mjs';

function validReport(){
  const state=()=>({nonFinite:0,bounds:{min:[-1,0,-1],max:[1,2,1]},activeMorphs:1,maxMorph:1});
  return {errors:[],console:[],info:{meshCount:1},initial:state(),expressions:Object.fromEntries(['aa','ih','ou','ee','oh','blink','blinkLeft','blinkRight','happy','angry','sad','relaxed','surprised'].map(n=>[n,state()])),poses:Object.fromEntries(['idle','wave','leg'].map(n=>[n,{...state(),changed:3,maxDistance:0.2}])),physics:{...state(),frames:600,maxBoneDisplacement:0.2}};
}
test('preserves transient simulation failures even when the last frame is finite',()=>{
  assert.equal(mergeSimulationSnapshot({nonFinite:0},{nonFinite:2,frames:600}).nonFinite,2);
  assert.equal(mergeSimulationSnapshot({nonFinite:3},{nonFinite:2}).nonFinite,5);
  const report=validReport();report.physics.nonFinite=2;assert.throws(()=>validateRuntime(report),/nonfinite/);
});
test('rejects shader console errors and missing expression evidence',()=>{
  assert.equal(validateRuntime(validReport()),true);
  const shader=validReport();shader.console=[{type:'error',text:'THREE.WebGLProgram: Shader Error'}];assert.throws(()=>validateRuntime(shader),/shader/);
  const missing=validReport();delete missing.expressions.blinkRight;assert.throws(()=>validateRuntime(missing),/blinkRight/);
});
test('rejects null bounds, nonfinite weights, and nondeforming poses',()=>{
  const bounds=validReport();bounds.initial.bounds.min[0]=null;assert.throws(()=>validateRuntime(bounds),/bounds/);
  const weights=validReport();weights.expressions.aa.maxMorph=NaN;assert.throws(()=>validateRuntime(weights),/weights/);
  const pose=validReport();pose.poses.leg.changed=0;assert.throws(()=>validateRuntime(pose),/deform/);
});
