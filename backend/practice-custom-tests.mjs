import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {AppError,validateSubmission} from './verification.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateCustomCases(cases){
  if(!Array.isArray(cases)||cases.length>10)throw new AppError(400,'Save at most 10 custom cases.');
  const ids=new Set();
  for(const row of cases){
    if(!object(row)||typeof row.id!=='string'||!/^[a-f0-9-]{36}$/.test(row.id)||ids.has(row.id)||typeof row.label!=='string'||row.label.length>60||!Array.isArray(row.args)||!object(row.kwargs)||!Object.hasOwn(row,'expected'))throw new AppError(400,'Check custom case names, arguments and expected values.');
    ids.add(row.id);const stack=[[row,0]];let nodes=0;
    while(stack.length){const [v,depth]=stack.pop();if(++nodes>3000||depth>12||typeof v==='number'&&!Number.isFinite(v)||v===undefined||typeof v==='function')throw new AppError(400,'Custom cases must contain finite JSON values with limited nesting.');if(v&&typeof v==='object')for(const child of Object.values(v))stack.push([child,depth+1]);}
  }
  if(Buffer.byteLength(JSON.stringify(cases))>40000)throw new AppError(400,'Custom cases are too large.');
  return cases.map(({id,label,args,kwargs,expected})=>({id,label:label.trim(),args,kwargs,expected}));
}
export function customTestsView(session){return session.customTests||{revision:0,cases:[],lastRun:null};}
export function validCustomTests(group){
  try{if(!object(group)||!Number.isSafeInteger(group.revision)||group.revision<0)return false;validateCustomCases(group.cases);const r=group.lastRun;
    return r===null||object(r)&&typeof r.code==='string'&&r.code.length<=24000&&r.revision===group.revision&&r.scope==='learner_cases'&&r.expectationSource==='learner'&&typeof r.functionName==='string'&&Number.isFinite(Date.parse(r.createdAt))&&Number.isInteger(r.passed)&&r.passed>=0&&r.total===group.cases.length&&r.passed<=r.total&&Array.isArray(r.results)&&r.results.length===r.total&&r.results.every((v,i)=>v.caseId===group.cases[i].id&&['passed','failed','error'].includes(v.status)&&(!v.error||typeof v.error==='string'));
  }catch{return false;}
}
export function validCustomBaseline(value){
  if(!object(value)||!Number.isSafeInteger(value.revision)||value.revision<0)return false;
  if(value.snapshot===null)return true;
  const snapshot=value.snapshot;
  return object(snapshot)&&object(snapshot.run)&&Array.isArray(snapshot.cases)&&snapshot.cases.length>0&&validCustomTests({revision:snapshot.run.revision,cases:snapshot.cases,lastRun:snapshot.run});
}
export async function runCustomTests(session,code,run,now){
  const group=customTestsView(session);if(!group.cases.length)throw new AppError(400,'Save at least one custom case first.');
  const submission=validateSubmission({code,functionName:session.functionName,cases:group.cases.map(c=>({args:structuredClone(c.args),kwargs:structuredClone(c.kwargs),expected:null}))});
  const evidence=await run(submission);if(!Array.isArray(evidence.results)||evidence.results.length!==group.cases.length)throw new AppError(502,'Incomplete custom test execution.');
  const results=evidence.results.map((row,i)=>({caseId:group.cases[i].id,status:row.status==='error'?'error':isDeepStrictEqual(row.actual,group.cases[i].expected)?'passed':'failed',...(row.status==='error'?{error:String(row.error||'Execution error').slice(0,12000)}:{actual:row.actual})}));
  return {id:randomUUID(),code,functionName:session.functionName,revision:group.revision,createdAt:new Date(now()).toISOString(),passed:results.filter(r=>r.status==='passed').length,total:results.length,results,scope:'learner_cases',expectationSource:'learner'};
}
export function customTraceSource(session,body){
  const group=customTestsView(session),report=group.lastRun;
  if(!report||body.revision!==group.revision||body.runId!==report.id||body.code!==report.code||report.functionName!==session.functionName)throw new AppError(409,'Run your saved custom tests on this code before tracing.');
  const index=group.cases.findIndex(c=>c.id===body.caseId),item=group.cases[index],previous=report.results.find(r=>r.caseId===body.caseId);
  if(!item||!previous)throw new AppError(404,'Custom case not found.');
  return {report,item,previous,index};
}
export async function replayCustomCase(session,body,run,now){
  const {report,item,previous,index}=customTraceSource(session,body);
  const submission=validateSubmission({code:body.code,functionName:session.functionName,cases:[{args:structuredClone(item.args),kwargs:structuredClone(item.kwargs),expected:null}]});
  const evidence=await run(submission),row=evidence.results?.[0];
  if(evidence.results?.length!==1||row?.index!==0||!['passed','failed','error'].includes(row.status)||row.status!=='error'&&!Object.hasOwn(row,'actual'))throw new AppError(502,'Incomplete trace execution.');
  const status=row.status==='error'?'error':isDeepStrictEqual(row.actual,item.expected)?'passed':'failed';
  return {createdAt:new Date(now()).toISOString(),gradedAt:report.createdAt,caseIndex:index,functionName:session.functionName,code:body.code,args:structuredClone(item.args),kwargs:structuredClone(item.kwargs),expected:structuredClone(item.expected),scope:'learner_cases',expectationSource:'learner',reproduced:status===previous.status&&(status==='error'?row.error===previous.error:isDeepStrictEqual(row.actual,previous.actual)),execution:evidence.execution||'python',status,...(status==='error'?{error:row.error}:{actual:row.actual}),events:Array.isArray(row.trace)?row.trace.slice(0,80):[],truncated:Boolean(row.traceTruncated)||row.trace?.length>80,cached:false};
}
