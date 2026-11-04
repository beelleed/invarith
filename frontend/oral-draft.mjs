const active=oral=>oral?.status==='active'&&typeof oral.id==='string'&&typeof oral.practiceId==='string'&&Number.isInteger(oral.round)&&oral.round>=0&&typeof oral.question==='string';
export const oralDraftKey=(oral,locale)=>`invarith-oral-answer:${oral.practiceId}:${locale}:${oral.id}:${oral.round}`;
export function readOralDraft(storage,oral,locale){
  if(!active(oral))return '';try{const value=JSON.parse(storage.getItem(oralDraftKey(oral,locale)));return value?.version===1&&value.id===oral.id&&value.round===oral.round&&value.question===oral.question&&typeof value.answer==='string'&&value.answer.length<=4000?value.answer:'';}catch{return '';}
}
export function writeOralDraft(storage,oral,locale,answer){
  if(!active(oral)||typeof answer!=='string'||answer.length>4000)return false;
  try{storage.setItem(oralDraftKey(oral,locale),JSON.stringify({version:1,id:oral.id,round:oral.round,question:oral.question,answer}));return true;}catch{return false;}
}
export function clearOralDraft(storage,oral,locale){if(!active(oral))return;try{storage.removeItem(oralDraftKey(oral,locale));}catch{}}
