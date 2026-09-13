import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { mergeSimulationSnapshot } from './runtime_checks.mjs';

const scene=new THREE.Scene(); scene.background=new THREE.Color('#e9e6e3');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.9;
document.body.append(renderer.domElement);
const environment=new RoomEnvironment();
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(environment,0.04).texture;
scene.environmentIntensity=0.6;
environment.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(28,innerWidth/innerHeight,0.01,30);
const controls=new OrbitControls(camera,renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0xb9b2bd,0.6));
const key=new THREE.DirectionalLight(0xfff5ee,2.2); key.position.set(-1,3,3); scene.add(key);
const fill=new THREE.DirectionalLight(0xe7eeff,0.8); fill.position.set(2,1,-2); scene.add(fill);
const loader=new GLTFLoader(); loader.register(p=>new VRMLoaderPlugin(p));
const gltf=await loader.loadAsync('/model.vrm');
const vrm=gltf.userData.vrm; scene.add(vrm.scene);
const meshes=[]; vrm.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
if(!meshes.length)throw new Error('VRM contains no skinned avatar geometry');
const initialBonePositions=new Map(); vrm.scene.updateMatrixWorld(true);
vrm.scene.traverse(o=>{if(o.isBone)initialBonePositions.set(o.uuid,o.getWorldPosition(new THREE.Vector3()).clone());});
function frame(kind='full'){
  const head=vrm.humanoid.getRawBoneNode('head').getWorldPosition(new THREE.Vector3());
  if(kind==='face'){controls.target.set(0,head.y+0.07,0);camera.position.set(0,head.y+0.075,0.68);}
  else if(kind==='side'){controls.target.set(0,0.82,0);camera.position.set(3.6,1.0,0);}
  else if(kind==='back'){controls.target.set(0,0.86,0);camera.position.set(0,1.0,-4.0);}
  else {controls.target.set(0,0.82,0);camera.position.set(0,0.95,3.8);}
  controls.update(); renderer.render(scene,camera);
}
function expression(name,weight=1){
  for(const e of vrm.expressionManager.expressions)vrm.expressionManager.setValue(e.expressionName,0);
  if(name)vrm.expressionManager.setValue(name,weight);
  vrm.update(0);renderer.render(scene,camera);
}
function pose(kind='idle'){
  vrm.humanoid.resetNormalizedPose();
  if(kind==='idle'){
    vrm.humanoid.getNormalizedBoneNode('leftUpperArm').rotation.z=-1.13;
    vrm.humanoid.getNormalizedBoneNode('rightUpperArm').rotation.z=1.13;
  }
  if(kind==='wave'){
    vrm.humanoid.getNormalizedBoneNode('leftUpperArm').rotation.z=-0.35;
    vrm.humanoid.getNormalizedBoneNode('leftLowerArm').rotation.y=-1.3;
    vrm.humanoid.getNormalizedBoneNode('rightUpperArm').rotation.z=1.13;
  }
  if(kind==='leg')vrm.humanoid.getNormalizedBoneNode('leftUpperLeg').rotation.x=-0.45;
  vrm.update(0); renderer.render(scene,camera);
}
function vertexSample(){
  const pts=[];
  for(const m of meshes){
    const attr=m.geometry.attributes.position;
    for(let i=0;i<attr.count;i+=Math.max(1,Math.floor(attr.count/80))){
      const v=new THREE.Vector3();m.getVertexPosition(i,v);m.localToWorld(v);pts.push(v.toArray());
    }
  }return pts;
}
function snapshot(){
  let maxMorph=0, activeMorphs=0;
  for(const m of meshes) for(const v of (m.morphTargetInfluences||[])){maxMorph=Math.max(maxMorph,Math.abs(v));if(v>0)activeMorphs++;}
  const bounds=new THREE.Box3().setFromObject(vrm.scene,true);
  let nonFinite=[...bounds.min.toArray(),...bounds.max.toArray()].filter(v=>!Number.isFinite(v)).length;vrm.scene.traverse(o=>{if(o.matrixWorld.elements.some(v=>!Number.isFinite(v)))nonFinite++;});
  return {activeMorphs,maxMorph,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},nonFinite};
}
function simulation(frames){
  let nonFinite=0,maxBoneDisplacement=0;const start=performance.now();
  const head=vrm.humanoid.getNormalizedBoneNode('head');
  for(let i=0;i<frames;i++){
    head.rotation.y=Math.sin(i/30)*0.2; vrm.update(1/60);vrm.scene.updateMatrixWorld(true);
    vrm.scene.traverse(o=>{if(o.isBone){const p=o.getWorldPosition(new THREE.Vector3());if(!p.toArray().every(Number.isFinite))nonFinite++;const p0=initialBonePositions.get(o.uuid);if(p0)maxBoneDisplacement=Math.max(maxBoneDisplacement,p.distanceTo(p0));}});
  }
  head.rotation.y=0;vrm.update(0);renderer.render(scene,camera);
  return mergeSimulationSnapshot(snapshot(),{frames,nonFinite,maxBoneDisplacement,elapsedMs:performance.now()-start});
}
window.qa={vrm,frame,expression,pose,vertexSample,snapshot,simulation,info:{meta:vrm.meta,meshCount:meshes.length,expressionNames:vrm.expressionManager.expressions.map(e=>e.expressionName),humanBones:Object.keys(vrm.humanoid.humanBones),renderer:renderer.capabilities.maxTextureSize,springJoints:vrm.springBoneManager?.joints.size}};
pose('tpose');frame();window.ready=true;
