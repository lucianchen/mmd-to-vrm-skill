import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const publishedFiles=['index.html','style.css','app.js','app.js.LEGAL.txt','example.json','.nojekyll'];

// Publish only browser code. Local example manifests and model assets never enter this build.
export async function buildComparison(outDir=path.join(repo,'dist')){
  const target=path.resolve(outDir);
  await fs.mkdir(target,{recursive:true});
  const unexpected=(await fs.readdir(target)).filter(name=>!publishedFiles.includes(name));
  if(unexpected.length)throw new Error('Refusing to publish unexpected files: '+unexpected.join(', '));
  await build({absWorkingDir:repo,entryPoints:['compare/app.js'],outfile:path.join(target,'app.js'),bundle:true,format:'esm',minify:true,sourcemap:false,legalComments:'linked',alias:{three:path.join(repo,'node_modules','three')},logLevel:'warning'});
  for(const name of ['index.html','style.css'])await fs.copyFile(path.join(repo,'compare',name),path.join(target,name));
  await fs.writeFile(path.join(target,'example.json'),JSON.stringify({mmd:null,vrm:null})+'\n');
  await fs.writeFile(path.join(target,'.nojekyll'),'');
  return target;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildComparison());
