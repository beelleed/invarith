import {createHash} from 'node:crypto';
import {practiceTasks} from './practice-contracts.mjs';
import {practiceDifficulty,practiceLevels,practiceTaskId} from '../frontend/practice-difficulty.mjs';
import {interviewQuestions,interviewTasks} from './interview-tasks.mjs';

export function interviewStudyPlan(session){
  if(session.status!=='finished'||!session.evaluation)return null;
  const evidence=session.evaluation.evidence,failed=Math.max(0,evidence.total-evidence.passed),hints=session.hints?.length||0;
  const discussed=new Set((session.rounds||[]).map(r=>r.questionId));
  const unassessed=Object.keys(interviewQuestions).filter(id=>!discussed.has(id));
  const reasons=[];
  if(failed)reasons.push({kind:'failing_cases',count:failed});
  if(hints)reasons.push({kind:'hints_used',count:hints});
  if(session.unansweredQuestion)reasons.push({kind:'unfinished_discussion',questionId:session.unansweredQuestion.id});
  if(!failed&&!hints)reasons.push({kind:'tested_cases_passed'});
  const id=session.practiceTask?.practiceTaskId||Object.keys(practiceTasks).find(key=>practiceTasks[key].name===session.practiceTask?.functionName);
  const topic=id?(practiceTasks[id]?.family||id.split(':')[0]):null;
  const alternatives=topic?practiceLevels(topic).map(level=>({level,taskId:practiceTaskId(topic,level)})).filter(task=>task.taskId!==id):[];
  const next=alternatives[0];
  return {interviewId:session.id,title:session.practiceTask?.title||interviewTasks.find(t=>t.id===session.taskId)?.title||session.taskId,topic,bugVersion:session.practiceTask?.bugVersion||null,bugVersions:session.practiceTask?.bugVersions||null,priority:failed?0:hints?1:2,reasons,unassessed,
    sameQuestion:{retryOf:session.id},relatedQuestion:next?{topic,level:next.level,taskId:next.taskId,difficulty:practiceDifficulty(next.taskId),mode:'coding'}:null,
    observed:{passed:evidence.passed,total:evidence.total,hintsUsed:hints},createdAt:session.finishedAt||session.updatedAt,
    note:'Unaddressed topics were not assessed, not answered incorrectly. A fresh retry is still a previously seen question.'};
}

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const caseKey=item=>createHash('sha256').update(JSON.stringify(stable({args:item.args,kwargs:item.kwargs||{},expected:item.expected}))).digest('hex');
const counts=cases=>{const out=new Map();for(const c of cases){const key=caseKey(c);out.set(key,(out.get(key)||0)+1);}return out;};
export function compareInterviewAttempts(before,after){
  if(before.status!=='finished'||after.status!=='finished'||!before.evaluation||!after.evaluation)return null;
  const a=before.evaluation,b=after.evaluation,ak=counts(a.cases),bk=counts(b.cases);
  let matched=0;for(const[key,count]of ak)matched+=Math.min(count,bk.get(key)||0);
  const task=s=>s.practiceTask||null;
  const sameContract=Boolean(before.taskId===after.taskId&&(before.contractKey&&after.contractKey?before.contractKey===after.contractKey:task(before)&&task(after)&&task(before).functionName===task(after).functionName&&task(before).prompt===task(after).prompt));
  const sameCases=matched===a.cases.length&&matched===b.cases.length;
  const complete=[a,b].every(e=>e.evidence.total===e.cases.length&&e.evidence.results?.length===e.cases.length&&e.evidence.passed===e.evidence.results.filter(r=>r.status==='passed').length&&e.evidence.results.every((r,i)=>r.index===i&&['passed','failed','error'].includes(r.status)));
  const comparable=Boolean(sameContract&&sameCases&&complete);
  let fixed=null,regressed=null;
  if(comparable){fixed=regressed=0;const prior=new Map();a.cases.forEach((c,i)=>{const key=caseKey(c);if(!prior.has(key))prior.set(key,[]);prior.get(key).push(a.evidence.results[i].status);});b.cases.forEach((c,i)=>{const old=prior.get(caseKey(c)).shift(),latest=b.evidence.results[i].status;if(old!=='passed'&&latest==='passed')fixed++;if(old==='passed'&&latest!=='passed')regressed++;});}
  const summary=s=>({passed:s.evaluation.evidence.passed,total:s.evaluation.evidence.total,hintsUsed:s.hints?.length||0,answeredQuestions:s.rounds?.length||0});
  return {beforeId:before.id,afterId:after.id,comparable,sameContract,sameCases,matchedCases:matched,addedCases:b.cases.length-matched,removedCases:a.cases.length-matched,fixed,regressed,before:summary(before),after:summary(after),note:comparable?'Identical contract and case expectations compared. Different hints or prior exposure prevent a claim of independent skill improvement.':'Contracts or test cases differ, or evidence is incomplete. Pass counts are separate observations, not a measured improvement.'};
}
