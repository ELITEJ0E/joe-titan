import {test} from 'node:test';
import assert from 'node:assert/strict';
import {escapeAction,titleCameraPose} from '../src/menu-presentation.js';

test('Escape pauses active flight and resumes when paused, without repeats',()=>{
 assert.equal(escapeAction({started:true,paused:false}), 'pause');
 assert.equal(escapeAction({started:true,paused:true}), 'resume');
 assert.equal(escapeAction({started:true,paused:true,repeat:true}), 'none');
 assert.equal(escapeAction({started:false,paused:false}), 'none');
 assert.equal(escapeAction({started:true,finished:true,paused:false}), 'none');
});
test('title camera is close enough to frame blocks instead of a distant aerial haze',()=>{
 const start=titleCameraPose(0);
 const radius=Math.hypot(start.position[0],start.position[2]);
 assert.ok(radius>=115&&radius<=140);
 assert.ok(start.position[1]<90);
 assert.ok(start.fov>=60&&start.fov<=70);
 for(const time of [2,60,120]){
  const pose=titleCameraPose(time);
  assert.ok(Math.abs(Math.hypot(pose.position[0],pose.position[2])-radius)<1e-9);
  assert.ok(pose.position.every(Number.isFinite));
 }
});
