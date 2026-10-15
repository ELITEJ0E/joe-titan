import * as THREE from 'three';

// Original stylized large-scale explosion: rising stem, cauliflower canopy,
// heat flash and expanding ground shockwaves. No external image assets.
export function createTitanBlastEffects(scene){
 const bursts=[];
 const sphere=new THREE.IcosahedronGeometry(1,1);
 const ringGeo=new THREE.RingGeometry(.78,1,64);
 const materials=[];
 const makeMat=(color,opacity)=>{const m=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide
 });materials.push(m);return m;};
 function spawn(position,{radius=35,height=60}={}){
  const root=new THREE.Group();root.position.copy(position);scene.add(root);
  const parts=[];
  const cloud=(x,y,z,size,color,delay=0)=>{
   const mesh=new THREE.Mesh(sphere,makeMat(color,.55));
   mesh.position.set(x,y,z);mesh.scale.setScalar(.01);root.add(mesh);
   parts.push({mesh,size,delay,x,y,z});return mesh;
  };
  cloud(0,12,0,10,0xffca72,0);
  for(let layer=0;layer<5;layer++){
   const y=height*(.1+layer*.16);
   for(let i=0;i<4;i++){
    const a=(i/4+layer*.21)*Math.PI*2;
    const spread=(2.4+layer*1.6);
    cloud(Math.cos(a)*spread,y,Math.sin(a)*spread,
      5+layer*.8,layer%2?0x888178:0xbeb0a0,layer*.09);
   }
  }
  const capY=height*.90;
  for(let ring=0;ring<3;ring++)for(let i=0;i<10;i++){
   const a=i/10*Math.PI*2+ring*.14;
   const spread=radius*(.23+ring*.18);
   cloud(Math.cos(a)*spread,capY+Math.sin(a*2+ring)*2,
     Math.sin(a)*spread,radius*(ring===2?.25:.21),
     ring===2?0x726f70:0x9a9290,.35+ring*.10);
  }
  const shockwaves=[];
  for(let n=0;n<2;n++){
   const mesh=new THREE.Mesh(ringGeo,makeMat(n?0xe5c4a2:0xffd2a0,n?.34:.7));
   mesh.rotation.x=-Math.PI/2;mesh.position.y=.30+n*.16;root.add(mesh);
   shockwaves.push(mesh);
  }
  const blast={root,parts,shockwaves,time:0,duration:5.4,radius,height};
  bursts.push(blast);return blast;
 }
 function update(dt){
  for(let i=bursts.length-1;i>=0;i--){
   const blast=bursts[i];blast.time+=Math.max(0,dt);
   const t=blast.time/blast.duration;
   for(const part of blast.parts){
    const p=Math.max(0,(t-part.delay*.15)/(1-part.delay*.15));
    const k=Math.min(1,p*4.2);
    part.mesh.scale.setScalar(part.size*Math.max(.001,k));
    part.mesh.position.set(part.x*(.45+.55*k),part.y*Math.min(1,p*2),part.z*(.45+.55*k));
    part.mesh.material.opacity=(part.delay===0?.65:.54)*Math.min(1,p*13)*Math.pow(1-t,.65);
   }
   blast.shockwaves.forEach((m,j)=>{
    const p=Math.min(1,Math.max(0,(t-j*.055)*3));
    m.scale.setScalar(Math.max(.01,blast.radius*p));
    m.material.opacity=(j?.33:.7)*Math.pow(1-p,2);
   });
   if(t>=1){scene.remove(blast.root);blast.root.traverse(o=>o.material?.dispose?.());bursts.splice(i,1);}
  }
 }
 function clear(){
  for(const blast of bursts){scene.remove(blast.root);blast.root.traverse(o=>o.material?.dispose?.());}
  bursts.length=0;
 }
 function dispose(){clear();sphere.dispose();ringGeo.dispose();}
 return {spawn,update,clear,dispose,get activeCount(){return bursts.length;}};
}
