import {ViewerError} from './i18n.mjs';

export function normalizeAssetPath(value){
  let decoded=value;try{decoded=decodeURIComponent(value);}catch{}
  const parts=[];
  for(const part of decoded.replaceAll('\\','/').split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)throw new ViewerError('assetEscape');parts.pop();}else parts.push(part);}
  return parts.join('/');
}
export function resolveSelectedFile(files,url){
  const key=normalizeAssetPath(url.replace(/^\/selected\//,''));
  if(files.has(key))return files.get(key);
  const folded=[...files.keys()].filter(k=>k.toLocaleLowerCase()===key.toLocaleLowerCase());
  if(folded.length===1)return files.get(folded[0]);
  throw new ViewerError(folded.length?'ambiguousTexture':'missingTexture',{path:key});
}
