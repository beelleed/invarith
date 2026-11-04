import {validateDesignDraft} from './system-design-data.mjs';

export function savedDesignDraft(session,draft,answer,earlierExplanation=null){
  return {version:1,revision:session.revision,round:session.rounds.length,question:session.question||'',draft:validateDesignDraft(draft),answer:typeof answer==='string'?answer.slice(0,4000):'',earlierExplanation:cleanEarlier(earlierExplanation)};
}
const cleanEarlier=value=>value&&typeof value.answer==='string'&&value.answer.trim()?{question:typeof value.question==='string'?value.question.slice(0,1000):'',answer:value.answer.slice(0,4000)}:null;
export function restoreDesignDraft(session,input){
  if(!input||session.status!=='active')return null;
  let draft;try{draft=validateDesignDraft(input.draft);}catch{return null;}
  const answer=typeof input.answer==='string'?input.answer.slice(0,4000):'';
  const sameQuestion=input.version===1&&input.round===session.rounds.length&&input.question===(session.question||'');
  const matches=sameQuestion&&input.revision===session.revision;
  return {draft,answer:sameQuestion?answer:'',earlierExplanation:!sameQuestion&&answer?cleanEarlier({question:input.question,answer}):cleanEarlier(input.earlierExplanation),requiresChoice:!matches};
}
