import test from 'node:test';
import assert from 'node:assert/strict';
import {recordLesson} from '../scripts/record_lesson.mjs';

const lesson=()=>({id:'verified-example',status:'verified',date:'2026-09-13',scope:'Synthetic fixture',observation:'A previously empty morph is removed.',resolution:'Rebind the remaining targets.',evidence:['node --test tests/optimizer.test.mjs','https://github.com/pixiv/three-vrm'],regression:'Material split fixture',limitations:'No real character included.',extra:{retain:'additional context'}});
test('records verified evidence, preserves extra context, and makes duplicate recording a no-op',()=>{
  const entry=lesson(),first=recordLesson([],entry);assert.equal(first.changed,true);assert.deepEqual(first.lessons[0].extra,entry.extra);
  const again=recordLesson(first.lessons,entry);assert.equal(again.changed,false);assert.equal(again.lessons.length,1);
});
test('revisions require explicit replacement and preserve the input history',()=>{
  const existing=[lesson()],revised={...lesson(),resolution:'Improved verified handling'};
  assert.throws(()=>recordLesson(existing,revised),/--replace/);
  const result=recordLesson(existing,revised,{replace:true});assert.equal(result.lessons.length,1);assert.equal(result.lessons[0].resolution,revised.resolution);assert.notEqual(existing[0].resolution,revised.resolution);
});
test('rejects hypotheses, missing evidence, and machine-specific paths while accepting URLs',()=>{
  assert.throws(()=>recordLesson([],{...lesson(),status:'hypothesis'}),/verified/);
  assert.throws(()=>recordLesson([],{...lesson(),evidence:[]}),/evidence/);
  for(const location of ['C:/Users/example/model.pmx','C:\\Users\\example\\model.pmx','/home/example/model.pmx','/Users/example/model.pmx'])assert.throws(()=>recordLesson([],{...lesson(),evidence:[location]}),/paths/);
  assert.doesNotThrow(()=>recordLesson([],lesson()));
});
