import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
import {AppError,validateSubmission} from './verification.mjs';
import {checkMutations} from './mutation.mjs';
import {validateCustomCases} from './practice-custom-tests.mjs';
export function customStrengthSource(session,body){
  const group=session.customTests,report=group?.lastRun;
  if(!report||body.revision!==group.revision||body.runId!==report.id||body.code!==report.code||report.functionName!==session.functionName)throw new AppError(409,'Run your saved custom tests on this code before challenging them.');
  if(!group.cases.length||report.passed!==group.cases.length||report.results.length!==group.cases.length||report.results.some(row=>row.status!=='passed'))throw new AppError(409,'All custom cases must match your expectations before this check.');
  return {group,report};
}
export async function checkCustomTestStrength(session,body,run,scan){
  const {group,report}=customStrengthSource(session,body);
  const submission=validateSubmission({code:report.code,functionName:session.functionName,cases:group.cases.map(c=>({args:structuredClone(c.args),kwargs:structuredClone(c.kwargs),expected:structuredClone(c.expected)}))});
  // Expectations remain outside submitted Python, including during baseline and variant replays.
  const observed=async input=>{
    const evidence=await run({...input,cases:input.cases.map(c=>({...structuredClone(c),expected:null}))});
    if(evidence.results?.length!==input.cases.length||evidence.results.some((row,i)=>row.index!==i||!['passed','failed','error'].includes(row.status)||row.status!=='error'&&!Object.hasOwn(row,'actual')))throw new AppError(502,'Incomplete mutation execution evidence.');
    const results=evidence.results.map((row,i)=>({...row,status:row.status==='error'?'error':isDeepStrictEqual(row.actual,input.cases[i].expected)?'passed':'failed'}));
    return {...evidence,results,passed:results.filter(row=>row.status==='passed').length,total:results.length};
  };
  const result=await checkMutations({submission,evidence:{id:report.id,total:group.cases.length,passed:report.passed,results:report.results}},observed,scan);
  return {...result,checkId:randomUUID(),scope:'learner_cases',expectationSource:'learner',revision:group.revision};
}
export function customVariantSource(session,body,report){
  customStrengthSource(session,body);
  if(!report||body.checkId!==report.checkId||report.sourceRunId!==body.runId)throw new AppError(409,'Reopen your test challenge before probing a change.');
  const variant=report.variants.find(row=>row.id===body.variantId&&row.status==='survived');
  if(!variant)throw new AppError(409,'Choose an undistinguished change from the current test challenge.');
  return variant;
}
export async function probeCustomVariant(session,body,report,run){
  const variant=customVariantSource(session,body,report);
  const item=validateCustomCases([{id:randomUUID(),label:typeof body.label==='string'?body.label:'Counterexample',args:body.args,kwargs:body.kwargs===undefined?{}:body.kwargs,expected:body.expected}])[0];
  const observe=async code=>{
    const evidence=await run(validateSubmission({code,functionName:session.functionName,cases:[{args:structuredClone(item.args),kwargs:structuredClone(item.kwargs),expected:null}]})),row=evidence.results?.[0];
    if(evidence.results?.length!==1||row?.index!==0||!['passed','failed','error'].includes(row.status)||row.status!=='error'&&!Object.hasOwn(row,'actual'))throw new AppError(502,'Incomplete counterexample execution.');
    return row.status==='error'?{status:'error',error:String(row.error||'Execution error').slice(0,12000)}:{status:isDeepStrictEqual(row.actual,item.expected)?'passed':'failed',actual:row.actual};
  };
  const original=await observe(session.customTests.lastRun.code),changed=await observe(variant.code);
  const status=original.status==='error'||changed.status==='error'?'execution_error':original.status!=='passed'?'review_expected':isDeepStrictEqual(original.actual,changed.actual)?'same':'distinguished';
  return {id:randomUUID(),createdAt:new Date().toISOString(),sourceRunId:body.runId,checkId:report.checkId,variantId:variant.id,status,original,changed,case:item,scope:'learner_cases',expectationSource:'learner'};
}
