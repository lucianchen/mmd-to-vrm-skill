import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {build} from 'esbuild';

export function resolveWithin(root,relative){
  const base=path.resolve(root),candidate=path.resolve(base,relative);
  if(candidate!==base&&!candidate.startsWith(base+path.sep))throw new Error('Path escapes selected asset directory');
  return candidate;
}
export async function startComparison({port=8766,mmd,vrm}={}){
  const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(repo,'output','compare-build');
  fs.mkdirSync(out,{recursive:true});
  await build({entryPoints:[path.join(repo,'compare','app.js')],outfile:path.join(out,'app.js'),bundle:true,format:'esm',alias:{three:path.join(repo,'node_modules','three')},logLevel:'warning'});
  const source=mmd?fs.realpathSync(mmd):null,converted=vrm?fs.realpathSync(vrm):null,assetRoot=source?fs.realpathSync(path.dirname(source)):null;
  if(source&&!/\.pmx$/i.test(source))throw new Error('--mmd must name a PMX file');
  if(converted&&!/\.vrm$/i.test(converted))throw new Error('--vrm must name a VRM file');
  const manifest={mmd:source?{url:'/model-assets/'+encodeURIComponent(path.basename(source)),name:path.basename(source),bytes:fs.statSync(source).size}:null,vrm:converted?{url:'/example.vrm',name:path.basename(converted),bytes:fs.statSync(converted).size}:null};
  const staticFiles=new Map([['/',[path.join(repo,'compare','index.html'),'text/html; charset=utf-8']],['/app.js',[path.join(out,'app.js'),'text/javascript; charset=utf-8']],['/style.css',[path.join(repo,'compare','style.css'),'text/css; charset=utf-8']]]);
  const types={'.pmx':'application/octet-stream','.vrm':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.bmp':'image/bmp','.tga':'application/octet-stream','.sph':'application/octet-stream','.spa':'application/octet-stream','.webp':'image/webp','.gif':'image/gif'};
  const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const url=new URL(req.url,'http://127.0.0.1');let entry=staticFiles.get(url.pathname);
      if(url.pathname==='/example.json'){res.setHeader('Content-Type','application/json');res.end(req.method==='HEAD'?'':JSON.stringify(manifest));return;}
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      if(url.pathname==='/example.vrm'&&converted)entry=[converted,types['.vrm']];
      if(url.pathname.startsWith('/model-assets/')&&assetRoot){const relative=decodeURIComponent(url.pathname.slice('/model-assets/'.length));const file=fs.realpathSync(resolveWithin(assetRoot,relative));resolveWithin(assetRoot,path.relative(assetRoot,file));const type=types[path.extname(file).toLowerCase()];if(type)entry=[file,type];}
      if(!entry||!fs.statSync(entry[0]).isFile()){res.writeHead(404);res.end('Not found');return;}
      res.setHeader('Content-Type',entry[1]);res.setHeader('Content-Length',fs.statSync(entry[0]).size);if(req.method==='HEAD'){res.end();return;}fs.createReadStream(entry[0]).on('error',()=>res.destroy()).pipe(res);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(port),'127.0.0.1',resolve);});
  const url=`http://127.0.0.1:${server.address().port}`;console.log(JSON.stringify({url,mmd:manifest.mmd?.name||null,vrm:manifest.vrm?.name||null,pid:process.pid}));
  return {server,url};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{port:{type:'string',default:'8766'},mmd:{type:'string'},vrm:{type:'string'}}});
  const {server}=await startComparison(values);for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
