export const MISSION_MODES=Object.freeze([
  Object.freeze({id:'course',name:'Skyline Circuit',kind:'TIME TRIAL',description:'Thread the six Asterfell signal beacons as fast as you can.',objective:'Capture all six signal beacons',duration:null,record:'FASTEST TIME'}),
  Object.freeze({id:'hunt',name:'Riftborn Hunt',kind:'ELIMINATION',description:'Hunt down all six Riftborn before the ward overwhelms you.',objective:'Disperse every Riftborn',duration:null,record:'FASTEST TIME'}),
  Object.freeze({id:'survival',name:'Last Light',kind:'SURVIVAL',description:'Stay airborne and survive a 90-second Riftborn assault.',objective:'Hold the ward for 01:30',duration:90,record:'WARD STATUS'}),
  Object.freeze({id:'free',name:'Free Flight',kind:'OPEN WORLD',description:'Explore Asterfell, practise your lines, and engage the Riftborn.',objective:'Explore the city at your own pace',duration:null,record:'NO CLOCK'})
]);

export const MISSION_RECORDS_KEY='joe-titan-mission-records';

export function readMissionRecords(storage){
  const records={bestTimes:{},completed:[]};
  try{
    const saved=JSON.parse(storage.getItem(MISSION_RECORDS_KEY)||'null');
    if(saved&&typeof saved==='object'){
      for(const mission of MISSION_MODES){
        const best=Number(saved.bestTimes?.[mission.id]);
        if(Number.isFinite(best)&&best>0)records.bestTimes[mission.id]=best;
      }
      if(Array.isArray(saved.completed))records.completed=[...new Set(saved.completed.filter(id=>MISSION_MODES.some(mission=>mission.id===id)))];
      if(!records.bestTimes.course){const legacy=Number(storage.getItem('joe-titan-best')||storage.getItem('aetherline-best'));if(Number.isFinite(legacy)&&legacy>0)records.bestTimes.course=legacy;}
    }else{
      const legacy=Number(storage.getItem('joe-titan-best')||storage.getItem('aetherline-best'));
      if(Number.isFinite(legacy)&&legacy>0)records.bestTimes.course=legacy;
    }
  }catch{}
  return records;
}

export function recordMission(records,missionId,time){
  const mission=MISSION_MODES.find(item=>item.id===missionId);
  if(!mission||mission.id==='free')return {newBest:false,records};
  const previous=records.bestTimes[missionId];
  const newBest=Number.isFinite(time)&&time>0&&(!previous||time<previous);
  if(newBest)records.bestTimes[missionId]=time;
  if(!records.completed.includes(missionId))records.completed.push(missionId);
  return {newBest,records};
}
