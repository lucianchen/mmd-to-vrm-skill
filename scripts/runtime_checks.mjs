// Shared by the browser probe and Node audit; no Node-only dependencies.
const check=(value,message)=>{if(!value)throw new Error(message);};
const standardExpressions=['aa','ih','ou','ee','oh','blink','blinkLeft','blinkRight','happy','angry','sad','relaxed','surprised'];

export function mergeSimulationSnapshot(snapshot,stats){
  return {...snapshot,...stats,nonFinite:snapshot.nonFinite+stats.nonFinite};
}

export function validateRuntime(report){
  check(Array.isArray(report.errors)&&report.errors.length===0,'Browser page errors were reported');
  check(Array.isArray(report.console)&&!report.console.some(e=>e.type==='error'||/CONTEXT_LOST|Multiple instances|Shader Error|VALIDATE_STATUS.*false/i.test(e.text)),'Browser console or shader errors were reported');
  check(report.info?.meshCount>0,'Avatar contains no skinned geometry');
  const snapshot=(value,name)=>{
    check(value&&value.nonFinite===0,`${name}: nonfinite geometry or simulation state`);
    check(value.bounds?.min?.length===3&&value.bounds?.max?.length===3&&[...value.bounds.min,...value.bounds.max].every(Number.isFinite),`${name}: invalid bounds`);
    check(Number.isFinite(value.maxMorph)&&value.maxMorph<=1,`${name}: invalid morph weights`);
  };
  snapshot(report.initial,'initial');
  for(const name of standardExpressions){snapshot(report.expressions?.[name],name);check(report.expressions[name].activeMorphs>0,`${name}: no active morphs`);}
  for(const [name,value] of Object.entries(report.additionalExpressions||{}))snapshot(value,name);
  for(const name of ['idle','wave','leg']){const pose=report.poses?.[name];snapshot(pose,name);check(pose.changed>0&&Number.isFinite(pose.maxDistance),`${name}: pose did not deform geometry`);}
  snapshot(report.physics,'physics');
  check(report.physics.frames===600&&Number.isFinite(report.physics.maxBoneDisplacement),'Incomplete or invalid physics run');
  return true;
}
