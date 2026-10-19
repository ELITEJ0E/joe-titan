import * as THREE from 'three';

// Large-scale mushroom cloud in three GPU draws per blast: one instanced
// smoke canopy/stem plus two shockwaves. Previously ~53 separate meshes
// AND materials created a burst of GPU draw calls during the special.
export function createTitanBlastEffects(scene){
 const bursts=[];
 const sphere=new THREE.IcosahedronGeometry(1,1),ringGeo=new THREE.RingGeometry(.78,1,64);
 const dummy=new THREE.Object3D();
 function spawn(position,{radius=35,height=60}={}){
  const root=new THREE.Group();root.position.copy(position);scene.add(root);
  const parts=[];
  const cloud=(x,y,z,size,color,delay=0)=>{
   parts.push({x,y,z,size,color,delay});
  };
  cloud(0,12,0,10,0xffca72,0);
  for(let layer=0;layer<5;layer++){
   const y=height*(.1+layer*.16);
   for(let i=0;i<4;i++){
    const a=(i/4+layer*.21)*Math.PI*2,spread=2.4+layer*1.6;
    cloud(Math.cos(a)*spread,y,Math.sin(a)*spread,5+layer*.8,
      layer%2?0x888178:0xbeb0a0,layer*.09);
   }
  }
  const capY=height*.90;
  for(let ring=0;ring<3;ring++)for(let i=0;i<10;i++){
   const a=i/10*Math.PI*2+ring*.14,spread=radius*(.23+ring*.18);
   cloud(Math.cos(a)*spread,capY+Math.sin(a*2+ring)*2,Math.sin(a)*spread,
     radius*(ring===2?.25:.21),ring===2?0x726f70:0x9a9290,.35+ring*.10);
  }
  const smokeMaterial=new THREE.MeshBasicMaterial({
    vertexColors:false,color:0xffffff,transparent:true,opacity:.55,
    depthWrite:false,side:THREE.FrontSide
  });
  const smoke=new THREE.InstancedMesh(sphere,smokeMaterial,parts.length);
  smoke.name='Colossal mushroom smoke / instanced';
  smoke.frustumCulled=false;
  parts.forEach((part,i)=>{
    smoke.setColorAt(i,new THREE.Color(part.color));
    dummy.position.set(0,-10000,0);dummy.scale.setScalar(.0001);
    dummy.rotation.set(0,0,0);dummy.updateMatrix();smoke.setMatrixAt(i,dummy.matrix);
  });
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smoke.instanceMatrix.needsUpdate=true;
  if(smoke.instanceColor)smoke.instanceColor.needsUpdate=true;
  root.add(smoke);
  const shockwaves=[];
  for(let n=0;n<2;n++){
    const material=new THREE.MeshBasicMaterial({
      color:n?0xe5c4a2:0xffd2a0,transparent:true,opacity:n?.34:.7,
      depthWrite:false,side:THREE.DoubleSide
    });
    const ring=new THREE.Mesh(ringGeo,material);
    ring.rotation.x=-Math.PI/2;ring.position.y=.30+n*.16;root.add(ring);
    shockwaves.push(ring);
  }
  const blast={root,smoke,parts,shockwaves,time:0,duration:5.4,radius,height};
  bursts.push(blast);return blast;
 }
 function remove(blast){
  scene.remove(blast.root);
  blast.smoke.material.dispose();
  blast.smoke.dispose?.();
  for(const ring of blast.shockwaves)ring.material.dispose();
 }
 function update(dt){
  for(let i=bursts.length-1;i>=0;i--){
   const blast=bursts[i];blast.time+=Math.max(0,dt);
   const t=blast.time/blast.duration;
   blast.parts.forEach((part,j)=>{
    const p=Math.max(0,(t-part.delay*.15)/(1-part.delay*.15));
    const k=Math.min(1,p*4.2);
    const scale=part.size*Math.max(.001,k);
    dummy.position.set(part.x*(.45+.55*k),part.y*Math.min(1,p*2),
      part.z*(.45+.55*k));
    dummy.scale.setScalar(scale);
    dummy.rotation.set(0,0,0);dummy.updateMatrix();
    blast.smoke.setMatrixAt(j,dummy.matrix);
   });
   blast.smoke.instanceMatrix.needsUpdate=true;
   blast.smoke.material.opacity=.55*Math.pow(Math.max(0,1-t),.65);
   blast.shockwaves.forEach((m,j)=>{
    const p=Math.min(1,Math.max(0,(t-j*.055)*3));
    m.scale.setScalar(Math.max(.01,blast.radius*p));
    m.material.opacity=(j?.33:.7)*Math.pow(1-p,2);
   });
   if(t>=1){remove(blast);bursts.splice(i,1);}
  }
 }
 function clear(){for(const b of bursts)remove(b);bursts.length=0;}
 function dispose(){clear();sphere.dispose();ringGeo.dispose();}
 return {spawn,update,clear,dispose,get activeCount(){return bursts.length;}};
}
