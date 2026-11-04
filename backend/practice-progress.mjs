import {practiceLevels,practiceTaskId} from '../frontend/practice-difficulty.mjs';
import {practiceTopics} from '../frontend/practice-topics.mjs';

// Summaries contain no code, test inputs, expectations or assistant messages.
export function summarizePracticeProgress(sessions){
  function summarize(id,matching){
    const submissions=matching.flatMap(session=>{
      const reports=Object.values(session.reports||{});
      if(session.lastResult&&!reports.some(r=>r.createdAt===session.lastResult.createdAt&&r.action===session.lastResult.action))reports.push(session.lastResult);
      return reports.filter(r=>(r.action==='submit'||r.scope==='hidden_cases')&&Number.isInteger(r.total)&&r.total>0&&Number.isInteger(r.passed)&&r.passed>=0&&r.passed<=r.total)
        .map(report=>({...report,sessionId:session.id}));
    }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    const latest=submissions[0];
    const status=latest?(latest.passed===latest.total?'tested_pass':'needs_review'):matching.length?'not_submitted':'not_started';
    const recent=[...matching].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
    const pendingSessionId=recent&&!Object.values(recent.reports||{}).some(row=>row.action==='submit'||row.scope==='hidden_cases')&&recent.lastResult?.action!=='submit'&&recent.lastResult?.scope!=='hidden_cases'?recent.id:null;
    return {id,status,resumeSessionId:recent?.id||null,pendingSessionId,questions:matching.length,retainedSubmissions:submissions.length,assistantRequests:matching.reduce((sum,s)=>sum+(s.assistantHistory?.length||0),0),latest:latest?{sessionId:latest.sessionId,passed:latest.passed,total:latest.total,createdAt:latest.createdAt}:null};
  }
  const topics=practiceTopics.map(({id})=>{const matching=sessions.filter(s=>s.topic===id);const curated=practiceLevels(id).map(level=>{const taskId=practiceTaskId(id,level);return {...summarize(taskId,matching.filter(s=>(s.taskId||s.topic)===taskId)),topic:id,level};});
    const generated=[...new Set(matching.filter(s=>s.kind==='generated'&&s.taskId?.startsWith('generated:')).map(s=>s.taskId))].map(taskId=>{const items=matching.filter(s=>s.taskId===taskId);return {...summarize(taskId,items),topic:id,level:'standard',kind:'generated',title:items[0].title};});
    return {...summarize(id,matching),contracts:[...curated,...generated]};});
  const contracts=topics.flatMap(t=>t.contracts);
  const review=contracts.filter(t=>t.status==='needs_review').sort((a,b)=>(a.latest.createdAt||'').localeCompare(b.latest.createdAt||''))[0];
  const pending=contracts.find(t=>t.status==='not_submitted');
  const extension=topics.filter(t=>t.latest).flatMap(t=>t.contracts).find(t=>t.status==='not_started');
  const next=review||pending||extension||contracts.find(t=>t.status==='not_started');
  const activity=sessions.flatMap(session=>{
    const reports=Object.values(session.reports||{});
    if(session.lastResult&&!reports.some(r=>r.createdAt===session.lastResult.createdAt&&r.action===session.lastResult.action))reports.push(session.lastResult);
    const seen=new Set();
    return reports.filter(r=>{const key=r.createdAt;if(!(r.action==='submit'||r.scope==='hidden_cases')||!Number.isInteger(r.total)||r.total<=0||!Number.isInteger(r.passed)||r.passed<0||r.passed>r.total||!Number.isFinite(Date.parse(r.createdAt))||seen.has(key))return false;seen.add(key);return true;})
      .map(r=>({taskId:session.taskId||session.topic,topic:session.topic,sessionId:session.id,createdAt:r.createdAt,passed:r.passed,total:r.total,...(session.assessmentReview?{reviewOfAssessment:true}:{}),...(session.retryOf?{reviewOfPractice:true}:{})}));
  }).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  return {activity,topics,totalTasks:contracts.length,submittedTasks:contracts.filter(c=>c.latest).length,passingTasks:contracts.filter(c=>c.status==='tested_pass').length,totalTopics:topics.length,submittedTopics:topics.filter(t=>t.latest).length,passingTopics:topics.filter(t=>t.status==='tested_pass').length,recommendation:next?{topic:next.topic,level:next.level,reason:next.status,sessionId:review?review.latest.sessionId:pending&&next===pending?sessions.find(s=>(s.taskId||s.topic)===next.id)?.id:null}:null};
}
