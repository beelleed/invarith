import {assessmentReviewFingerprint} from './assessment-review.mjs';
const requests=session=>Array.isArray(session.assistantHistory)?session.assistantHistory.length:0;
const totals=attempt=>attempt&&Number.isInteger(attempt.total)&&attempt.total>0&&attempt.total<=20&&Number.isInteger(attempt.passed)&&attempt.passed>=0&&attempt.passed<=attempt.total;
const complete=(attempt,fingerprint,total)=>totals(attempt)&&Number.isFinite(Date.parse(attempt.createdAt))&&attempt.total===total&&attempt.suiteKey===fingerprint&&Array.isArray(attempt.statuses)&&attempt.statuses.length===total&&attempt.statuses.every(status=>['passed','failed','error'].includes(status))&&attempt.passed===attempt.statuses.filter(status=>status==='passed').length;

export function captureRetryBaseline(source,now=Date.now()){
  const attempt=source.attempts?.at(-1);
  return {practiceId:source.id,title:source.title,fingerprint:assessmentReviewFingerprint(source),total:source.hidden.length,capturedAt:new Date(now).toISOString(),assistantRequests:requests(source),submission:attempt?structuredClone(attempt):null};
}
export function compareRetry(session){
  const after=session.attempts?.at(-1);if(!after)return {available:false,reason:'submit_current'};
  const baseline=session.retryBaseline,before=baseline?.submission;
  if(!before)return {available:false,reason:'baseline_missing'};
  if(typeof before.code!=='string'||typeof after.code!=='string'||before.code.length>24000||after.code.length>24000)return {available:false,reason:'incomplete_evidence'};
  const fingerprint=assessmentReviewFingerprint(session),comparable=baseline.fingerprint===fingerprint&&complete(before,baseline.fingerprint,baseline.total)&&complete(after,fingerprint,session.hidden.length);
  const describe=(attempt,id,assistantRequests)=>({practiceId:id,code:attempt.code,createdAt:attempt.createdAt,passed:totals(attempt)?attempt.passed:null,total:totals(attempt)?attempt.total:null,assistantRequests});
  const rows=comparable?before.statuses.map((status,index)=>({index,before:status,after:after.statuses[index],change:status!=='passed'&&after.statuses[index]==='passed'?'fixed':status==='passed'&&after.statuses[index]!=='passed'?'regressed':'unchanged'})):[];
  return {available:true,comparable,capturedAt:baseline.capturedAt,before:describe(before,baseline.practiceId,Number.isSafeInteger(baseline.assistantRequests)&&baseline.assistantRequests>=0?baseline.assistantRequests:null),after:describe(after,session.id,requests(session)),rows,fixed:comparable?rows.filter(row=>row.change==='fixed').length:null,regressed:comparable?rows.filter(row=>row.change==='regressed').length:null};
}
