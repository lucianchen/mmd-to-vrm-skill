import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {translations,translate,detectLanguage,ViewerError} from '../compare/i18n.mjs';
import {buildComparison,publishedFiles} from '../scripts/build_compare.mjs';

test('both languages translate all keys with identical parameters',()=>{
  assert.deepEqual(Object.keys(translations.zh).sort(),Object.keys(translations.en).sort());
  for(const key of Object.keys(translations.en)){
    const params=value=>[...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(params(translations.en[key]),params(translations.zh[key]),key);
    assert.ok(translations.zh[key].length&&translations.en[key].length,key);
  }
  assert.throws(()=>translate('en','unknown'),/Missing translation/);
  assert.throws(()=>translate('en','triangles'),/Missing translation argument/);
});
test('URL language takes priority, then saved choice, then browser preference',()=>{
  assert.equal(detectLanguage({requested:'en',saved:'zh',languages:['zh-CN']}),'en');
  assert.equal(detectLanguage({saved:'zh',languages:['en-US']}),'zh');
  assert.equal(detectLanguage({languages:['zh-TW']}),'zh');
  assert.equal(detectLanguage({requested:'fr',saved:'de',languages:['ja-JP']}),'en');
});
test('structured errors can be translated without losing the original path',()=>{
  const error=new ViewerError('missingTexture',{path:'avatar/脸.png'});
  assert.match(translate('en',error.key,error.params),/Missing selected texture: avatar\/脸.png/);
  assert.match(translate('zh',error.key,error.params),/缺少所选贴图：avatar\/脸.png/);
});
test('static build contains only browser files and supports a project subpath',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mmd-viewer-build-'));
  try{
    await buildComparison(dir);
    assert.deepEqual((await fs.readdir(dir)).sort(),[...publishedFiles].sort());
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'example.json'),'utf8')),{mmd:null,vrm:null});
    const html=await fs.readFile(path.join(dir,'index.html'),'utf8');
    assert.match(html,/src="\.\/app\.js"/);assert.match(html,/href="\.\/style\.css"/);
    assert.doesNotMatch(html,/(?:src|href)="\/(?!\/)/);
    const script=await fs.readFile(path.join(dir,'app.js'),'utf8');
    assert.doesNotMatch(script,/[A-Z]:[\\/](?:Users|AICompanion)[\\/]/i);
    await fs.writeFile(path.join(dir,'accidental-model.vrm'),'must not publish');
    await assert.rejects(()=>buildComparison(dir),/unexpected files: accidental-model.vrm/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
