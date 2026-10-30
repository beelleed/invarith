export const recallStorageKey='invarith-note-recall:v1';
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export const recallableNotes=notes=>notes.filter(n=>validId(n.id)&&Number.isInteger(n.revision)&&n.revision>=0&&(n.observation?.trim()||n.nextTime?.trim()));
export function createRecallRound(notes,round=1){return {version:1,cards:recallableNotes(notes).slice(0,100).map(n=>({id:n.id,revision:n.revision})),position:0,answers:{},ratings:{},round};}
export function restoreRecallRound(raw,notes){
  try{
    if(typeof raw!=='string'||raw.length>700000)return null;const state=JSON.parse(raw);
    if(state.version!==1||!Array.isArray(state.cards)||!state.cards.length||state.cards.length>100||!Number.isInteger(state.position)||state.position<0||state.position>state.cards.length||!Number.isInteger(state.round)||state.round<1||!state.answers||typeof state.answers!=='object'||Array.isArray(state.answers)||!state.ratings||typeof state.ratings!=='object'||Array.isArray(state.ratings))return null;
    const available=new Map(recallableNotes(notes).map(n=>[n.id,n])),ids=state.cards.map(c=>c.id);
    if(new Set(ids).size!==ids.length||state.cards.some(c=>!validId(c.id)||available.get(c.id)?.revision!==c.revision))return null;
    if(Object.entries(state.answers).some(([id,value])=>!ids.includes(id)||typeof value!=='string'||value.length>3000))return null;
    if(Object.entries(state.ratings).some(([id,value])=>!ids.slice(0,state.position).includes(id)||!['again','remembered'].includes(value)))return null;
    if(ids.slice(0,state.position).some(id=>!Object.hasOwn(state.ratings,id)||state.ratings[id]==='remembered'&&!state.answers[id]?.trim()))return null;
    return {version:1,cards:state.cards.map(c=>({id:c.id,revision:c.revision})),position:state.position,answers:{...state.answers},ratings:{...state.ratings},round:state.round};
  }catch{return null;}
}
export function rateRecallRound(state,rating){
  const card=state.cards[state.position];if(!card||!['again','remembered'].includes(rating)||rating==='remembered'&&!state.answers[card.id]?.trim())return state;
  return {...state,position:state.position+1,ratings:{...state.ratings,[card.id]:rating}};
}
