import { caseKey } from './evidence-tools.mjs';

export const requirementLabels={awaiting_review:'Awaiting your review',needs_clarification:'Needs clarification',no_evidence:'No linked evidence',missing_evidence:'Linked case missing from this run',supported_examples:'Supported by linked examples',needs_attention:'Linked test needs attention',out_of_scope:'Intent or function changed'};
export function requirementCoverage(map,submission,evidence){
  if(!map)return [];
  const same=map.scope.functionName===submission.functionName && map.scope.intent===(submission.intent || '').trim();
  const cases=new Map();
  submission.cases.forEach((item,index)=>{const key=caseKey(item);if(!cases.has(key))cases.set(key,[]);cases.get(key).push({index,item,result:evidence.results?.find(row=>row.index===index)});});
  return map.requirements.map(requirement=>{
    const review=map.reviews?.find(item=>item.requirementId===requirement.id);
    const links=[...new Set(review?.caseKeys || [])].flatMap(key=>cases.has(key)?cases.get(key).map(item=>({key,...item})):[{key}]);
    const status=!same?'out_of_scope':requirement.kind==='question'?'needs_clarification':!review?'awaiting_review':!links.length?'no_evidence':links.some(link=>['failed','error'].includes(link.result?.status))?'needs_attention':links.some(link=>link.result?.status!=='passed')?'missing_evidence':'supported_examples';
    return {...requirement,status,links,reviewed:Boolean(review),confirmedAt:review?.confirmedAt || null};
  });
}
