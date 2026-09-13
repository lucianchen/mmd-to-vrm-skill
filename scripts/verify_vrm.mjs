import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validateRuntime} from './runtime_checks.mjs';
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},dependencies:{type:'string'},expressions:{type:'string'}}});
assert.ok(values.input&&values.output,'Usage: node verify_vrm.mjs --input model.vrm --output qa-directory [--dependencies directory-with-package-json]');
const input=path.resolve(values.input),root=path.resolve(values.output),scriptRoot=path.dirname(fileURLToPath(import.meta.url));
assert.ok(fs.existsSync(input),'Input VRM does not exist');fs.mkdirSync(root,{recursive:true});
const dependencies=values.dependencies?path.resolve(values.dependencies):path.resolve(scriptRoot,'..');
const require=createRequire(path.join(dependencies,'package.json'));
const {build}=require('esbuild');
const {chromium}=require('@playwright/test');
const threeRoot=path.dirname(path.dirname(require.resolve('three')));
await build({entryPoints:[path.join(scriptRoot,'viewer.js')],bundle:true,format:'esm',outfile:path.join(root,'viewer.bundle.js'),alias:{three:threeRoot},nodePaths:[path.join(dependencies,'node_modules')]});
const allowed=new Map([['model.vrm',input],['viewer.bundle.js',path.join(root,'viewer.bundle.js')]]);
const server=http.createServer((req,res)=>{
  const name=(req.url||'/').slice(1).split('?')[0];
  if(!name){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><title>VRM validation</title><style>body{margin:0;overflow:hidden}</style></head><body><script type="module" src="/viewer.bundle.js"></script></body></html>');return;}
  if(!allowed.has(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(allowed.get(name)).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={inputSha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),console:[],errors:[]};let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:1100}});
  page.on('console',msg=>{if(['warning','error'].includes(msg.type()))report.console.push({type:msg.type(),text:msg.text()});});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.ready,{},{timeout:120000});
  report.info=await page.evaluate(()=>qa.info);report.initial=await page.evaluate(()=>qa.snapshot());
  await page.screenshot({path:path.join(root,'preview-tpose.png')});
  report.expressions={};
  await page.evaluate(()=>qa.frame('face'));
  for(const name of ['neutral','aa','ih','ou','ee','oh','blink','blinkLeft','blinkRight','happy','angry','sad','relaxed','surprised']){
    await page.evaluate(n=>qa.expression(n),name);
    report.expressions[name]=await page.evaluate(()=>qa.snapshot());
    await page.screenshot({path:path.join(root,`face-${name}.png`)});
  }
  report.additionalExpressions={};
  const extra=values.expressions?JSON.parse(fs.readFileSync(values.expressions,'utf8')):[];
  for(const [index,name] of extra.entries()){
    assert.ok(report.info.expressionNames.includes(name),'Requested expression missing: '+name);
    await page.evaluate(n=>qa.expression(n),name);
    report.additionalExpressions[name]={...await page.evaluate(()=>qa.snapshot()),materials:await page.evaluate(()=>qa.vrm.materials.map(m=>({name:m.name,opacity:m.opacity})))};
    await page.screenshot({path:path.join(root,'extra-'+index+'.png')});
  }
  await page.evaluate(()=>{qa.expression(null);qa.pose('tpose');qa.frame('full');});
  const base=await page.evaluate(()=>qa.vertexSample());report.poses={};
  for(const name of ['idle','wave','leg']){
    await page.evaluate(n=>qa.pose(n),name);
    const sample=await page.evaluate(()=>qa.vertexSample());
    let changed=0,maxDistance=0;sample.forEach((v,i)=>{const d=Math.hypot(...v.map((x,j)=>x-base[i][j]));if(d>0.0001)changed++;maxDistance=Math.max(maxDistance,d);});
    report.poses[name]={changed,maxDistance,...await page.evaluate(()=>qa.snapshot())};
    await page.screenshot({path:path.join(root,`preview-${name}.png`)});
  }
  await page.evaluate(()=>qa.pose('idle'));
  report.physics=await page.evaluate(()=>qa.simulation(600));
  await page.screenshot({path:path.join(root,'preview-after-physics.png')});
  await page.evaluate(()=>qa.frame('back'));await page.screenshot({path:path.join(root,'preview-back.png')});
  validateRuntime(report);
  report.status='completed';
}catch(e){report.status='failed';report.error=e.stack;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(root,'runtime-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,error:report.error,errors:report.errors,initial:report.initial,poses:report.poses,physics:report.physics},null,2));


if(report.status!=='completed')process.exitCode=1;
