import {canonical} from './evidence-tools.mjs';
const identity=c=>canonical({args:c.args,kwargs:c.kwargs||{},expected:c.expected});
const valid=(cases,run)=>Array.isArray(cases)&&run&&typeof run.functionName==='string'&&Array.isArray(run.results)&&cases.length===run.results.length&&new Set(cases.map(c=>c.id)).size===cases.length&&cases.every(c=>{const rows=run.results.filter(r=>r.caseId===c.id);return rows.length===1&&['passed','failed','error'].includes(rows[0].status);});
export function compareCustomCases(baseline,cases,run){
  if(!baseline||!valid(baseline.cases,baseline.run)||!valid(cases,run)||baseline.run.functionName!==run.functionName)return {comparable:false};
  const used=new Set(),matched=new Map();
  // Reserve unchanged identifiers first so duplicate inputs keep their own evidence after reordering.
  cases.forEach((item,index)=>{const previous=baseline.cases.find(c=>c.id===item.id&&identity(c)===identity(item));if(previous){used.add(previous.id);matched.set(index,previous);}});
  cases.forEach((item,index)=>{if(matched.has(index))return;const previous=baseline.cases.find(c=>!used.has(c.id)&&identity(c)===identity(item));if(previous){used.add(previous.id);matched.set(index,previous);}});
  const rows=cases.map((item,index)=>{const match=matched.get(index),after=run.results.find(r=>r.caseId===item.id),before=match&&baseline.run.results.find(r=>r.caseId===match.id);return {item,index,before:before||null,after,change:!before?'added':before.status!=='passed'&&after.status==='passed'?'fixed':before.status==='passed'&&after.status!=='passed'?'regressed':'unchanged'};});
  baseline.cases.forEach((item,index)=>{if(!used.has(item.id))rows.push({item,index,before:baseline.run.results.find(r=>r.caseId===item.id),after:null,change:'removed'});});
  const count=kind=>rows.filter(r=>r.change===kind).length;
  return {comparable:true,rows,fixed:count('fixed'),regressed:count('regressed'),added:count('added'),removed:count('removed'),compared:rows.filter(r=>r.before&&r.after).length};
}
