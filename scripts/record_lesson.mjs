import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';

export function recordLesson(existing,entry,{replace=false}={}){
  assert.ok(Array.isArray(existing));
  assert.match(entry.id||'',/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Stable lowercase lesson id required');
  assert.equal(entry.status,'verified','Record verified learning only; keep hypotheses in local task reports');
  for(const field of ['date','scope','observation','resolution','regression','limitations'])assert.ok(typeof entry[field]==='string'&&entry[field].trim(),`Missing ${field}`);
  assert.ok(Array.isArray(entry.evidence)&&entry.evidence.length&&entry.evidence.every(e=>typeof e==='string'&&e.trim()),'Verification evidence required');
  assert.ok(!/(?:^|["\s])[A-Za-z]:[\\/]|\/(?:Users|home)\//.test(JSON.stringify(entry)),'Remove machine-specific absolute paths from published lessons');
  const found=existing.findIndex(e=>e.id===entry.id);
  if(found>=0){
    if(JSON.stringify(existing[found])===JSON.stringify(entry))return {changed:false,lessons:existing};
    assert.ok(replace,'Lesson id already exists; review the previous entry and use --replace for a verified correction');
  }
  const lessons=structuredClone(existing);
  if(found<0)lessons.push(entry);else lessons[found]=entry;
  return {changed:true,lessons};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{entry:{type:'string'},'skill-dir':{type:'string'},replace:{type:'boolean',default:false}}});
  assert.ok(values.entry,'Usage: node scripts/record_lesson.mjs --entry verified-lesson.json [--replace]');
  const root=values['skill-dir']?path.resolve(values['skill-dir']):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  assert.ok(fs.existsSync(path.join(root,'SKILL.md')),'Target must be an existing skill root');
  const target=path.join(root,'references','lessons.json');
  const existing=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):[];
  const entry=JSON.parse(fs.readFileSync(values.entry,'utf8'));
  const result=recordLesson(existing,entry,{replace:values.replace});
  if(result.changed){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result.lessons,null,2)+'\n');}
  console.log(JSON.stringify({changed:result.changed,id:entry.id,total:result.lessons.length}));
}
