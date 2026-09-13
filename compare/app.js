import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {MMDLoader} from 'three/examples/jsm/loaders/MMDLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OutlineEffect} from 'three/examples/jsm/effects/OutlineEffect.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {normalizeAssetPath,resolveSelectedFile} from './file_paths.mjs';
import {detectLanguage,translate,ViewerError} from './i18n.mjs';

const $=id=>document.getElementById(id),panes={},messages={},urls=new Set();let syncing=false,currentView='full',selectedFiles=new Map(),loadQueue=Promise.resolve();
let savedLanguage;try{savedLanguage=localStorage.getItem('mmd-vrm-language');}catch{}
let language=detectLanguage({requested:new URL(location.href).searchParams.get('lang'),saved:savedLanguage,languages:navigator.languages});
let statusState={key:'readyPrompt',params:{},error:false};
const t=(key,params)=>translate(language,key,params);
function refreshStatus(){const {key,params,error}=statusState;const args=key==='loaded'?{summary:Object.entries(messages).map(([kind,pose])=>kind.toUpperCase()+' '+t(pose)).join(' / ')}:params;$('status').textContent=t(key,args);$('status').classList.toggle('error',error);}
function status(key,params={},error=false){statusState={key,params,error};refreshStatus();}
function showError(error){console.error(error);if(error instanceof ViewerError)status(error.key,error.params,true);else status('rawError',{message:error.message||String(error)},true);}
function refreshPane(pane){
  $(pane.kind+'-name').textContent=pane.root?pane.name:t(pane.loading?'loading':pane.kind==='mmd'?'waitingMmd':'waitingVrm');
  $(pane.kind+'-stats').textContent=pane.stats?t('triangles',{count:pane.stats.triangles.toLocaleString(language),size:(pane.bytes/1e6).toFixed(1)}):pane.loading?t('readingGeometry'):pane.kind==='mmd'?t('mmdFiles'):'VRM 1.0 / 0.x';
  pane.renderer.domElement.setAttribute('aria-label',t('modelCanvas',{kind:pane.kind.toUpperCase()}));
}
function applyLanguage(){document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=t('title');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));document.querySelectorAll('[data-lang]').forEach(el=>{el.classList.toggle('active',el.dataset.lang===language);el.setAttribute('aria-pressed',String(el.dataset.lang===language));});Object.values(panes).forEach(refreshPane);refreshStatus();}
function setLanguage(value){language=detectLanguage({requested:value});try{localStorage.setItem('mmd-vrm-language',language);}catch{}const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);applyLanguage();}
document.querySelectorAll('[data-lang]').forEach(el=>el.addEventListener('click',()=>setLanguage(el.dataset.lang)));
$('choose-mmd').addEventListener('click',()=>$('mmd-input').click());
$('choose-vrm').addEventListener('click',()=>$('vrm-input').click());
function createPane(kind){
  const host=$(kind+'-view'),scene=new THREE.Scene();scene.background=new THREE.Color('#eeece7');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label',kind.toUpperCase()+' 3D 模型');
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.6;environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0xb9b2bd,.6));
  for(const [color,intensity,position] of [[0xfff5ee,2.2,[-1,3,3]],[0xe7eeff,.8,[2,1,-2]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
  const camera=new THREE.PerspectiveCamera(28,1,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=.15;controls.maxDistance=20;controls.target.set(0,.825,0);camera.position.set(0,.95,4.1);controls.update();
  const effect=kind==='mmd'?new OutlineEffect(renderer,{defaultThickness:.003}):null;
  const pane={kind,host,scene,renderer,camera,controls,effect,root:null,vrm:null,mesh:null,objectURLs:[],bytes:0,stats:null};panes[kind]=pane;
  controls.addEventListener('change',()=>{if(syncing||!$('sync').checked)return;const other=panes[kind==='mmd'?'vrm':'mmd'];if(!other)return;syncing=true;other.camera.position.copy(camera.position);other.camera.quaternion.copy(camera.quaternion);other.controls.target.copy(controls.target);other.controls.update();syncing=false;});
  new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();status('contextLost',{},true);});
  return pane;
}
function disposeRoot(pane){
  if(pane.root){pane.scene.remove(pane.root);const textures=new Set(),materials=new Set(),geometries=new Set();pane.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)textures.add(u.value);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  for(const url of pane.objectURLs){URL.revokeObjectURL(url);urls.delete(url);}pane.objectURLs=[];pane.root=pane.vrm=pane.mesh=null;pane.stats=null;pane.loading=true;delete messages[pane.kind];$(pane.kind+'-empty').hidden=false;refreshPane(pane);
}
function alignMmdArms(mesh){
  let aligned=0;const find=names=>mesh.skeleton.bones.find(b=>names.includes(b.name));
  for(const [side,suffix,x] of [['左','L',1],['右','R',-1]]){
    const upper=find([side+'腕','腕.'+suffix]),lower=find([side+'ひじ','ひじ.'+suffix]),hand=find([side+'手首','手首.'+suffix]);if(!upper||!lower||!hand)continue;
    for(const [bone,child] of [[upper,lower],[lower,hand]]){mesh.updateMatrixWorld(true);const a=bone.getWorldPosition(new THREE.Vector3()),b=child.getWorldPosition(new THREE.Vector3()),delta=new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(),new THREE.Vector3(x,0,0));const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world));}
    aligned++;
  }
  mesh.updateMatrixWorld(true);return aligned===2;
}
function mount(pane,root,name,bytes,poseNote){
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root,true),size=bounds.getSize(new THREE.Vector3());if(!Number.isFinite(size.y)||size.y<.00001)throw new ViewerError('invalidHeight');
  const wrapper=new THREE.Group(),scale=1.65/size.y;wrapper.add(root);wrapper.scale.setScalar(scale);wrapper.position.set(-(bounds.min.x+bounds.max.x)/2*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)/2*scale);pane.root=wrapper;pane.scene.add(wrapper);wrapper.updateMatrixWorld(true);
  let triangles=0,vertices=0;root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;vertices+=g.attributes.position?.count||0;triangles+=(g.index?.count||g.attributes.position?.count||0)/3;});
  pane.bytes=bytes;pane.name=name;pane.loading=false;pane.stats={triangles,vertices,pose:poseNote};refreshPane(pane);$(pane.kind+'-empty').hidden=true;messages[pane.kind]=poseNote;frame(currentView);status('loaded');
}
function managerFor(resolver){
  let done,fail;const complete=new Promise((a,b)=>{done=a;fail=b;}),manager=new THREE.LoadingManager(done,undefined,url=>fail(new ViewerError('resourceFailed',{url})));manager.setURLModifier(url=>{if(url.startsWith('data:')||(url.startsWith('blob:')&&new URL(url).origin===location.origin))return url;return resolver(url);});return {manager,complete};
}
async function loadMmd(url,name,bytes,resolver,objectURLs=[]){
  const pane=panes.mmd;disposeRoot(pane);pane.objectURLs=objectURLs;status('loadingMmd');
  const {manager,complete}=managerFor(resolver),loader=new MMDLoader(manager);
  const [mesh]=await Promise.all([loader.loadAsync(url),complete]);pane.mesh=mesh;
  const aligned=alignMmdArms(mesh);mount(pane,mesh,name,bytes,aligned?'poseT':'poseSource');
}
async function loadVrm(url,name,bytes,resolver,objectURLs=[]){
  const pane=panes.vrm;disposeRoot(pane);pane.objectURLs=objectURLs;status('loadingVrm');
  const {manager,complete}=managerFor(resolver),loader=new GLTFLoader(manager);loader.register(p=>new VRMLoaderPlugin(p));
  const [gltf]=await Promise.all([loader.loadAsync(url),complete]);const vrm=gltf.userData.vrm;if(!vrm)throw new ViewerError('missingVrm');
  VRMUtils.rotateVRM0(vrm);vrm.humanoid.resetNormalizedPose();vrm.update(0);pane.vrm=vrm;mount(pane,vrm.scene,name,bytes,'poseT');
}
function schedule(fn){loadQueue=loadQueue.then(fn).catch(error=>{for(const pane of Object.values(panes)){pane.loading=false;refreshPane(pane);}showError(error);});return loadQueue;}
const objectURL=file=>{const url=URL.createObjectURL(file);urls.add(url);return url;};
async function loadSelectedMmd(key){const file=selectedFiles.get(key),owned=[],cache=new Map();const resolver=url=>{const found=resolveSelectedFile(selectedFiles,url);if(!cache.has(found)){const blob=objectURL(found);cache.set(found,blob);owned.push(blob);}return cache.get(found);};await loadMmd('/selected/'+key,file.name,file.size,resolver,owned);}
$('mmd-input').addEventListener('change',event=>{selectedFiles=new Map([...event.target.files].map(f=>[normalizeAssetPath(f.webkitRelativePath||f.name),f]));const models=[...selectedFiles.keys()].filter(k=>/\.pmx$/i.test(k));const select=$('pmx-select');select.replaceChildren(...models.map(key=>new Option(key.split('/').pop(),key)));$('model-choice').hidden=models.length<2;if(!models.length){status('noPmx',{},true);return;}schedule(()=>loadSelectedMmd(models[0]));});
$('pmx-select').addEventListener('change',e=>schedule(()=>loadSelectedMmd(e.target.value)));
$('vrm-input').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;schedule(async()=>{const url=objectURL(file);await loadVrm(url,file.name,file.size,v=>{if(v===url)return v;throw new ViewerError('externalVrm');},[url]);});});
function frame(kind){currentView=kind;syncing=true;for(const pane of Object.values(panes)){const {camera,controls}=pane;if(kind==='face'){controls.target.set(0,1.465,0);camera.position.set(0,1.47,.88);}else{controls.target.set(0,.825,0);const distance=Math.max(3.8,2.8/Math.max(.6,camera.aspect));camera.position.set(0,.91,kind==='back'?-distance:distance);}controls.update();}syncing=false;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===kind);b.setAttribute('aria-pressed',String(b.dataset.view===kind));});}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>frame(b.dataset.view)));
$('sync').addEventListener('change',()=>{if($('sync').checked){const {camera,controls}=panes.mmd;panes.vrm.camera.position.copy(camera.position);panes.vrm.controls.target.copy(controls.target);panes.vrm.controls.update();}});
$('exposure').addEventListener('input',event=>{const value=Number(event.target.value);$('exposure-value').value=value.toFixed(2);for(const p of Object.values(panes))p.renderer.toneMappingExposure=value;});
$('export').addEventListener('click',()=>{
  if(!panes.mmd.root||!panes.vrm.root){status('exportGuard',{},true);return;}
  render();const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=840;
  const c=canvas.getContext('2d');c.fillStyle='#fafaf7';c.fillRect(0,0,1200,840);c.fillStyle='#232a30';c.font='600 20px sans-serif';
  for(const [i,p] of Object.values(panes).entries()){
    c.fillText(t(i?'exportRight':'exportLeft'),i*600+24,38);
    const source=p.renderer.domElement,s=Math.min(600/source.width,750/source.height),w=source.width*s,h=source.height*s;
    c.fillStyle='#eeece7';c.fillRect(i*600,56,600,750);c.drawImage(source,i*600+(600-w)/2,56+(750-h)/2,w,h);c.fillStyle='#232a30';
  }
  c.fillStyle='#737b81';c.font='12px sans-serif';c.fillText(t('exportCaption'),24,826);
  canvas.toBlob(blob=>{if(!blob){status('exportFailed',{},true);return;}const url=objectURL(blob),a=document.createElement('a');a.href=url;a.download='mmd-vrm-comparison.png';a.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);status('exportDone');});
});
function render(){for(const pane of Object.values(panes)){pane.vrm?.update(0);if(pane.effect)pane.effect.render(pane.scene,pane.camera);else pane.renderer.render(pane.scene,pane.camera);}}
createPane('mmd');createPane('vrm');applyLanguage();let last=performance.now();
function tick(time){const delta=Math.min((time-last)/1000,.1);last=time;if($('rotate').checked){syncing=true;for(const pane of Object.values(panes)){const offset=pane.camera.position.clone().sub(pane.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),delta*.2);pane.camera.position.copy(pane.controls.target).add(offset);pane.controls.update();}syncing=false;}render();requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.comparison={panes,frame,render,ready:false,get language(){return language;},get state(){return Object.fromEntries(Object.entries(panes).map(([k,p])=>[k,{loaded:!!p.root,stats:p.stats,position:p.camera.position.toArray(),target:p.controls.target.toArray()}]));}};
window.addEventListener('beforeunload',()=>urls.forEach(url=>URL.revokeObjectURL(url)));
async function start(){const manifest=await fetch(new URL('example.json',import.meta.url)).then(r=>{if(!r.ok)throw new ViewerError('manifestFailed',{status:r.status});return r.json();});if(manifest.mmd){await schedule(()=>loadMmd(manifest.mmd.url,manifest.mmd.name,manifest.mmd.bytes,url=>{const resolved=new URL(url,location.href);if(resolved.origin!==location.origin||!resolved.pathname.startsWith('/model-assets/'))throw new ViewerError('mmdOutside');return resolved.href;}));}if(manifest.vrm){await schedule(()=>loadVrm(manifest.vrm.url,manifest.vrm.name,manifest.vrm.bytes,url=>{const resolved=new URL(url,location.href);if(resolved.origin!==location.origin||resolved.pathname!=='/example.vrm')throw new ViewerError('externalVrm');return resolved.href;}));}window.comparison.ready=true;}
start().catch(showError);
