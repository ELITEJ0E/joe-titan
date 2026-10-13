import * as THREE from 'three';

export function createNavigation(world, player, camera) {
  const map = document.getElementById('minimap');
  const context = map.getContext('2d');
  const waypoint = document.getElementById('waypoint');
  const project = new THREE.Vector3();
  const scale = map.width / 410;
  const center = map.width / 2;
  const x = value => center + value * scale;
  const y = value => center + value * scale;
  function update(index, practice, enemies=[], activeAspect=null) {
    context.clearRect(0, 0, map.width, map.height);
    context.fillStyle = '#0d202d';context.fillRect(0, 0, map.width, map.height);
    // Water, ramparts and districts are rendered as separate layers so the map
    // matches the actual geometry instead of reading as an undifferentiated grid.
    const canalZ=world.landmarks?.canalZ??108;
    context.fillStyle='#214b5d';context.fillRect(x(-165),y(canalZ-6),330*scale,12*scale);
    context.strokeStyle='#9ab0b8';context.lineWidth=5;context.strokeRect(x(-188),y(-188),376*scale,376*scale);
    context.strokeStyle='#718996';context.lineWidth=2.2;context.setLineDash([18*scale,9*scale]);context.strokeRect(x(-142),y(-142),284*scale,284*scale);context.setLineDash([]);
    context.strokeStyle='#2c5062';context.lineWidth=3;
    for(const road of world.districtRoads||[]){context.beginPath();context.moveTo(x(road.a[0]),y(road.a[1]));context.lineTo(x(road.b[0]),y(road.b[1]));context.stroke();}
    for (const b of world.colliders) {
      if(b.halfW>45||b.halfD>45)continue;
      context.fillStyle=b.h>40?'#9c7965':b.h>27?'#6f7880':'#435866';
      context.fillRect(x(b.x-b.halfW), y(b.z-b.halfD), Math.max(1,b.halfW*2*scale), Math.max(1,b.halfD*2*scale));
      if(b.h>27){context.strokeStyle='#c3aa91';context.lineWidth=.65;context.strokeRect(x(b.x-b.halfW),y(b.z-b.halfD),b.halfW*2*scale,b.halfD*2*scale);}
    }
    const cathedral=world.landmarks?.cathedral||[0,-13],plaza=world.landmarks?.plaza||[46.5,31];
    context.strokeStyle='#e1c08c';context.lineWidth=1.3;context.beginPath();context.arc(x(cathedral[0]),y(cathedral[1]),7,0,Math.PI*2);context.stroke();
    context.fillStyle='#e1c08c';context.fillRect(x(plaza[0])-2,y(plaza[1])-2,4,4);
    context.strokeStyle = '#edbc7870';context.setLineDash([3,4]);context.beginPath();
    world.beacons.forEach((beacon, i) => { const p=beacon.point;i?context.lineTo(x(p.x),y(p.z)):context.moveTo(x(p.x),y(p.z)); });
    context.stroke();context.setLineDash([]);
    world.beacons.forEach((beacon, i) => {
      const p=beacon.point;context.fillStyle=i===index&&!practice?'#ffd090':i<index&&!practice?'#8de0bb':'#7e9aab';
      context.beginPath();context.arc(x(p.x),y(p.z),i===index&&!practice?4:2.5,0,Math.PI*2);context.fill();
    });
    for(const enemy of enemies){if(!enemy.alive)continue;context.fillStyle=enemy.state==='pursue'||enemy.state==='strike'?'#ff7467':'#db8c74';context.beginPath();context.arc(x(enemy.position.x),y(enemy.position.z),enemy.type==='bruiser'?5:3.5,0,Math.PI*2);context.fill();}
    context.save();context.translate(x(player.position.x),y(player.position.z));context.rotate(-player.yaw);
    context.fillStyle='#a4edff';context.beginPath();context.moveTo(0,-6);context.lineTo(-4,5);context.lineTo(0,3);context.lineTo(4,5);context.closePath();context.fill();context.restore();
    if(activeAspect){context.strokeStyle='#fff0b2';context.lineWidth=2;context.beginPath();context.arc(x(player.position.x),y(player.position.z),8,0,Math.PI*2);context.stroke();}
    waypoint.classList.toggle('hidden', practice || index >= world.beacons.length);
    if (practice || index >= world.beacons.length) return;
    const point=world.beacons[index].group.position;
    camera.updateMatrixWorld();project.copy(point).project(camera);
    const facing=point.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()))>0;
    const width=innerWidth,height=innerHeight;
    let screenX=(project.x*.5+.5)*width,screenY=(-project.y*.5+.5)*height;
    const offscreen=!facing||screenX<50||screenX>width-50||screenY<110||screenY>height-170;
    if(!facing){
      const relative=point.clone().sub(player.position);
      const side=relative.x*Math.cos(player.yaw)-relative.z*Math.sin(player.yaw);
      screenX=side>=0?width-50:50;screenY=height*.45;
    }
    waypoint.style.left=`${Math.max(50,Math.min(width-50,screenX))}px`;
    waypoint.style.top=`${Math.max(110,Math.min(height-170,screenY))}px`;
    waypoint.classList.toggle('offscreen',offscreen);
    document.getElementById('waypointArrow').textContent=offscreen?(screenX>width/2?'›':'‹'):'◇';
    document.getElementById('waypointLabel').textContent=`${String(index+1).padStart(2,'0')} · ${Math.round(player.position.distanceTo(point))} m`;
  }
  return {update};
}
