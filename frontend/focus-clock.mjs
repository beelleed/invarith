export const focusClockKey='invarith-focus-clock-v1';
export const focusChoices=[15,25,45],breakChoices=[1,3,5];
export function newFocusClock(){return {version:1,focusMinutes:25,breakMinutes:5,phase:'focus',status:'idle',remainingMs:25*60000,deadline:null};}
const duration=clock=>(clock.phase==='focus'?clock.focusMinutes:clock.breakMinutes)*60000;
export function restoreFocusClock(raw){
  try{const value=JSON.parse(raw);if(value?.version!==1||!focusChoices.includes(value.focusMinutes)||!breakChoices.includes(value.breakMinutes)||!['focus','break'].includes(value.phase)||!['idle','running','paused','complete'].includes(value.status)||!Number.isSafeInteger(value.remainingMs)||value.remainingMs<0||value.remainingMs>duration(value))return newFocusClock();
    if(value.status==='running'?!(Number.isSafeInteger(value.deadline)&&value.deadline>0):value.deadline!==null)return newFocusClock();
    if(value.status==='complete'&&value.remainingMs!==0||value.status==='paused'&&value.remainingMs===0)return newFocusClock();
    return {version:1,focusMinutes:value.focusMinutes,breakMinutes:value.breakMinutes,phase:value.phase,status:value.status,remainingMs:value.remainingMs,deadline:value.deadline};
  }catch{return newFocusClock();}
}
export function focusClockView(clock,now=Date.now()){
  if(clock.status!=='running')return clock;
  const remainingMs=Math.max(0,Math.min(duration(clock),clock.deadline-now));
  return {...clock,status:remainingMs===0?'complete':'running',remainingMs,deadline:remainingMs===0?null:clock.deadline};
}
export function changeFocusClock(clock,action,now=Date.now()){
  const view=focusClockView(clock,now);
  if(action.type==='reset')return {...view,phase:'focus',status:'idle',remainingMs:view.focusMinutes*60000,deadline:null};
  if(action.type==='configure'&&['idle','complete'].includes(view.status)){
    const focusMinutes=action.focusMinutes??view.focusMinutes,breakMinutes=action.breakMinutes??view.breakMinutes;if(!focusChoices.includes(focusMinutes)||!breakChoices.includes(breakMinutes))return view;
    return view.status==='complete'?{...view,focusMinutes,breakMinutes}:{...view,focusMinutes,breakMinutes,phase:'focus',status:'idle',remainingMs:focusMinutes*60000,deadline:null};
  }
  if(action.type==='start'&&['idle','complete'].includes(view.status)&&['focus','break'].includes(action.phase)){const next={...view,phase:action.phase,status:'running'};next.remainingMs=duration(next);next.deadline=now+next.remainingMs;return next;}
  if(action.type==='pause'&&view.status==='running')return {...view,status:'paused',deadline:null};
  if(action.type==='resume'&&view.status==='paused')return {...view,status:'running',deadline:now+view.remainingMs};
  return view;
}
export function clockDisplay(milliseconds){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
