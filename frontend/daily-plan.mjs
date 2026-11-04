import {learningRecords,reviewSchedule} from './learning-records.mjs';
import {practiceDifficulty} from './practice-difficulty.mjs';

export function dailyPracticePlan(summary={},goal=3,now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
  goal=[1,3,5].includes(goal)?goal:3;
  const topics=summary.topics||[],contracts=topics.flatMap(row=>(row.contracts||[]).map(contract=>({...contract,topic:row.id}))),byId=new Map(contracts.map(row=>[row.id,row]));
  const activity=(summary.activity||[]).filter(row=>byId.has(row.taskId)&&typeof row.sessionId==='string'&&Number.isFinite(Date.parse(row.createdAt))&&Date.parse(row.createdAt)<=Number(now)&&Number.isInteger(row.total)&&row.total>0&&Number.isInteger(row.passed)&&row.passed>=0&&row.passed<=row.total);
  const records=learningRecords(activity,now,timeZone),schedule=reviewSchedule({...summary,activity},now,timeZone),seen=new Set(records.todayRows.map(row=>row.taskId));
  const completed=records.todayRows.map(row=>({...byId.get(row.taskId),latest:row,isReview:row.isReview})),remaining=Math.max(0,goal-completed.length),items=[],selected=new Set(seen);
  const usedTopics=new Set(completed.map(row=>row.topic));
  const add=(candidates,limit,reason,action,variety=false)=>{
    const pool=candidates.filter(row=>!selected.has(row.id));let added=0;
    while(pool.length&&items.length<remaining&&added<limit){const different=variety?pool.findIndex(row=>!usedTopics.has(row.topic)):-1;const row=pool.splice(different<0?0:different,1)[0];if(selected.has(row.id))continue;selected.add(row.id);usedTopics.add(row.topic);items.push({...row,reason:typeof reason==='function'?reason(row):reason,action,sessionId:action==='resume'?(row.pendingSessionId||row.resumeSessionId||row.latest?.sessionId):(row.latest?.sessionId||row.resumeSessionId||null)});added++;}
  };
  const due=schedule.due.filter(row=>row.latest?.sessionId&&!row.pendingSessionId&&!seen.has(row.id)),reviewBudget=Math.max(0,Math.ceil(goal/2)-records.reviewToday);
  add(due,reviewBudget,row=>row.failed?'missed_cases':'due_review','review');
  add(contracts.filter(row=>row.pendingSessionId||row.status==='not_submitted'&&row.resumeSessionId),remaining,'unfinished','resume',true);
  const offset=topics.length?Math.floor(Date.parse(records.today+'T00:00:00Z')/86400000)%topics.length:0,rotated=[...topics.slice(offset),...topics.slice(0,offset)],rank=new Map(rotated.map((row,index)=>[row.id,index]));
  const difficulty=row=>({easy:0,medium:1,hard:2})[practiceDifficulty(row.id)]??3;
  const ordered=rows=>rows.sort((a,b)=>difficulty(a)-difficulty(b)||(rank.get(a.topic)??999)-(rank.get(b.topic)??999)||a.id.localeCompare(b.id));
  add(ordered(contracts.filter(row=>row.status==='not_started'&&row.level==='standard'&&row.id===row.topic&&practiceDifficulty(row.id))),remaining,'new_topic','new',true);
  add(ordered(contracts.filter(row=>row.status==='not_started'&&row.level!=='standard'&&row.kind!=='generated'&&byId.get(row.topic)?.status==='tested_pass'&&practiceDifficulty(row.id))),remaining,'next_level','new',true);
  add(due,remaining,row=>row.failed?'missed_cases':'due_review','review');
  add(schedule.upcoming.filter(row=>row.latest?.sessionId),remaining,'early_review','review',true);
  return {date:records.today,goal,completed,practiced:completed.length,remaining,items};
}
